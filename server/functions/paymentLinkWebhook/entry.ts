import { createClientFromRequest } from "../../lib/sdk.ts";
import { secrets } from "../../lib/runtime.ts";
import {
  normalizeStatus, verifyWebhookSignature, verifyCheckoutStatus,
  findTxId, findCheckoutId, findStatus, findAmount
} from "../../shared/leekpay.ts";
import { settlePaymentLinkPayment, cancelPaymentLinkPayment, notifyMember } from "../../shared/paymentLinks.ts";

// Webhook LeekPay « liens de paiement » : confirmation réelle des paiements.
// Seules comptent 1) une signature HMAC valide signée avec la clé secrète,
// ou 2) une vérification directe du statut du checkout auprès de LeekPay.
// Au paiement confirmé, le créateur est crédité immédiatement du montant net
// (90 %) dans son portefeuille — écriture unique par paiement.
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

    const paymentId = findTxId(body);
    if (!paymentId) return Response.json({ error: "Paiement inconnu." }, { status: 400 });

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

    const payment = await admin.entities.PaymentLinkPayment.get(paymentId).catch(() => null);
    if (!payment) return Response.json({ error: "Paiement introuvable." }, { status: 404 });
    // Idempotence : une notification rejouée sur un paiement déjà traité est
    // acquittée sans effet — aucun double crédit n'est possible.
    if (payment.status !== "awaiting_payment") {
      return Response.json({ received: true, ignored: "already_settled" });
    }

    // Montant : toute différence entre le paiement et l'écriture bloque tout.
    const evAmount = findAmount(body);
    if (evAmount != null && Math.round(Number(evAmount)) !== payment.amount_fcfa) {
      await admin.entities.AuditLog.create({
        action: "payment_link_webhook",
        admin_email: "leekpay",
        result: "error",
        target_user_id: payment.creator_id,
        target_id: payment.id,
        reason: "Montant du paiement différent de l'écriture (" + evAmount + " vs " + payment.amount_fcfa + ")"
      });
      return Response.json({ error: "Montant incompatible avec le paiement." }, { status: 400 });
    }

    let normalized = signed ? normalizeStatus(findStatus(body)) : apiVerified.normalized;

    if (normalized === "paid") {
      const settled = await settlePaymentLinkPayment(admin, payment);
      if (settled.updated) {
        await admin.entities.AuditLog.create({
          action: "payment_link_webhook",
          admin_email: "leekpay",
          target_user_id: payment.creator_id,
          target_id: payment.id,
          details: "Paiement confirmé (" + payment.payment_ref + ", " + payment.amount_fcfa + " FCFA) — net créateur " + payment.net_fcfa + " FCFA, vérifié via " + provider
        });
        await notifyMember(sdk, { id: payment.creator_id, email: payment.creator_email },
          "Paiement reçu — " + payment.link_name,
          "Bonne nouvelle : un paiement de " + payment.amount_fcfa + " FCFA vient d'être confirmé via votre lien « " + payment.link_name + " »"
            + (payment.payer_name ? " (payeur : " + payment.payer_name + ")" : "")
            + ". Net crédité dans votre portefeuille : " + payment.net_fcfa + " FCFA après commission NOVATRAX de 10 %.");
      }
    } else if (normalized === "failed") {
      const cancelled = await cancelPaymentLinkPayment(admin, payment);
      if (cancelled.updated) {
        await admin.entities.AuditLog.create({
          action: "payment_link_webhook",
          admin_email: "leekpay",
          target_user_id: payment.creator_id,
          target_id: payment.id,
          details: "Paiement non abouti (" + payment.payment_ref + ") — aucun montant débité."
        });
      }
    }
    // pending / unknown : aucun changement, le paiement reste en attente.

    return Response.json({ received: true, status: normalized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}