import { createClientFromRequest } from "../../lib/sdk.ts";
import { secrets } from "../../lib/runtime.ts";
import {
  normalizeStatus, verifyWebhookSignature, verifyCheckoutStatus,
  findTxId, findCheckoutId, findStatus, findAmount
} from "../../shared/leekpay.ts";
import {
  settleMarketplaceOrderPayment, cancelMarketplaceOrder, notifyMember
} from "../../shared/marketplace.ts";

// Webhook LeekPay Marketplace : confirmation réelle des paiements d'achats.
// Seules comptent 1) une signature HMAC valide signée avec la clé secrète,
// ou 2) une vérification directe du statut du checkout auprès de LeekPay.
// Le vendeur n'est crédité qu'à la validation de la vente (confirmation de
// réception par l'acheteur ou décision administrative) — jamais ici.
export default async function(req) {
  try {
    const rawBody = await req.text();
    const secret = secrets.get("LEEKPAY_SECRET_KEY");
    if (!secret) return Response.json({ error: "Webhook non configuré." }, { status: 500 });

    let body = null;
    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch (e) {
      body = null;
    }
    if (!body) return Response.json({ error: "Corps de requête invalide." }, { status: 400 });

    const orderId = findTxId(body);
    if (!orderId) return Response.json({ error: "Commande inconnue." }, { status: 400 });

    const sdk = createClientFromRequest(req);
    const admin = sdk.asServiceRole;

    const signed = await verifyWebhookSignature(rawBody, req.headers, secret);
    let provider = "signature";
    let apiVerified = null;
    if (!signed) {
      apiVerified = await verifyCheckoutStatus(secret, findCheckoutId(body));
      if (!apiVerified.ok) {
        return Response.json({ error: "Signature invalide et statut invérifiable : notification ignorée." }, { status: 401 });
      }
      provider = "api";
    }

    const order = await admin.entities.MarketplaceOrder.get(orderId).catch(() => null);
    if (!order) return Response.json({ error: "Commande introuvable." }, { status: 404 });
    // Idempotence : une notification rejouée sur une commande déjà traitée est
    // acquittée sans effet — aucun double crédit n'est possible.
    if (order.status !== "awaiting_payment") {
      return Response.json({ received: true, ignored: "already_settled" });
    }

    // Montant : toute différence entre le paiement et la commande bloque tout.
    const evAmount = findAmount(body);
    if (evAmount != null && Math.round(Number(evAmount)) !== order.product_price_fcfa) {
      await admin.entities.AuditLog.create({
        action: "marketplace_webhook",
        admin_email: "leekpay",
        result: "error",
        target_user_id: order.buyer_id,
        target_id: order.id,
        reason: "Montant du paiement différent du prix de la commande (" + evAmount + " vs " + order.product_price_fcfa + ")"
      });
      return Response.json({ error: "Montant incompatible avec la commande." }, { status: 400 });
    }

    let normalized = signed ? normalizeStatus(findStatus(body)) : apiVerified.normalized;

    if (normalized === "paid") {
      const settled = await settleMarketplaceOrderPayment(admin, order);
      if (settled.updated) {
        await admin.entities.AuditLog.create({
          action: "marketplace_webhook",
          admin_email: "leekpay",
          target_user_id: order.buyer_id,
          target_id: order.id,
          details: "Paiement confirmé (" + order.order_ref + ", " + order.product_price_fcfa + " FCFA), vérifié via " + provider
        });
        await Promise.allSettled([
          notifyMember(sdk, { id: order.buyer_id, email: order.buyer_email },
            "Paiement confirmé — " + order.product_name,
            "Votre paiement pour la commande " + order.order_ref + " (" + order.product_price_fcfa + " FCFA) est confirmé. Le vendeur a été notifié — contactez-le au " + order.seller_phone + " pour la livraison, puis confirmez la réception dans « Mes achats »."),
          notifyMember(sdk, { id: order.seller_id, email: order.seller_email },
            "Nouvelle vente payée — " + order.product_name,
            "Bonne nouvelle : " + (order.buyer_name || "un acheteur") + " a payé la commande " + order.order_ref + " (" + order.product_price_fcfa + " FCFA). Net vendeur : " + order.net_fcfa + " FCFA après commission. Livrez à l'acheteur : " + (order.buyer_phone || order.buyer_email) + ". Le montant sera crédité à la confirmation de la réception.")
        ]);
      }
    } else if (normalized === "failed") {
      const cancelled = await cancelMarketplaceOrder(admin, order);
      if (cancelled.updated) {
        await admin.entities.AuditLog.create({
          action: "marketplace_webhook",
          admin_email: "leekpay",
          target_user_id: order.buyer_id,
          target_id: order.id,
          details: "Paiement non abouti (" + order.order_ref + ") — commande annulée, aucun montant débité."
        });
        await notifyMember(sdk, { id: order.buyer_id, email: order.buyer_email },
          "Commande annulée — " + order.product_name,
          "Le paiement de la commande " + order.order_ref + " n'a pas abouti. Aucun montant n'a été débité — vous pouvez retenter l'achat.");
      }
    }
    // pending / unknown : aucun changement, la commande reste en attente.

    return Response.json({ received: true, status: normalized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}