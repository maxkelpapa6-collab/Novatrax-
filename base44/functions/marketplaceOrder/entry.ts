import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  completeMarketplaceOrder, notifyMember, notifyAdmins
} from "../../shared/marketplace.ts";

// Actions de suivi de commande par l'acheteur et le vendeur :
// - confirm_receipt : l'acheteur valide la réception → la vente se termine et
//   le vendeur reçoit son net (90 %) dans son portefeuille, une seule fois.
// - dispute : ouverture d'un litige (paiement confirmé, réception contestée).
// Le vendeur n'est crédité que par ce flux ou par décision administrative.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (user.account_status === "suspended") {
      return Response.json({ error: "Votre compte est bloqué. Contactez le support NOVATRAX." }, { status: 403 });
    }
    const admin = base44.asServiceRole;

    const order = await admin.entities.MarketplaceOrder.get(body.order_id).catch(() => null);
    if (!order) return Response.json({ error: "Commande introuvable." }, { status: 404 });
    const isBuyer = order.buyer_id === user.id;
    const isSeller = order.seller_id === user.id;
    if (!isBuyer && !isSeller && user.role !== "admin") {
      return Response.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const action = String(body.action || "");
    if (action === "confirm_receipt") {
      if (!isBuyer) return Response.json({ error: "Seul l'acheteur peut confirmer la réception." }, { status: 403 });
      if (order.status !== "processing") {
        return Response.json({ error: "Cette commande ne peut pas être confirmée pour le moment." }, { status: 409 });
      }
      // Transition unique : la commande ne peut être terminée qu'une fois.
      await admin.entities.MarketplaceOrder.updateMany(
        { id: order.id, status: "processing" },
        { $set: { status: "completed" } }
      );
      const after = await admin.entities.MarketplaceOrder.get(order.id);
      if (after.status === "completed" && !after.sale_transaction_id) {
        // Crédit unique du vendeur (référence MKS-<commande>) : marque aussi
        // la date de fin de vente ; une exécution déjà en cours est idempotente.
        const result = await completeMarketplaceOrder(base44, admin, after);
        await admin.entities.AuditLog.create({
          action: "marketplace_order_completed",
          admin_email: user.email,
          target_user_id: order.seller_id,
          target_id: order.id,
          details: "Réception confirmée par l'acheteur — crédit vendeur " + order.net_fcfa + " FCFA (" + order.order_ref + ")"
        });
        return Response.json({ ok: true, status: "completed", sale_transaction_id: result.sale_transaction_id });
      }
      return Response.json({ ok: true, status: after.status });
    }

    if (action === "dispute") {
      if (!isBuyer && !isSeller) {
        return Response.json({ error: "Seuls l'acheteur et le vendeur peuvent ouvrir un litige." }, { status: 403 });
      }
      const reason = String(body.reason || "").trim();
      if (reason.length < 10) {
        return Response.json({ error: "Décrivez le problème en quelques mots (10 caractères minimum)." }, { status: 400 });
      }
      if (order.status !== "processing") {
        return Response.json({ error: "Un litige ne peut être ouvert que sur une commande payée et en cours." }, { status: 409 });
      }
      await admin.entities.MarketplaceOrder.updateMany(
        { id: order.id, status: "processing" },
        { $set: { status: "disputed", dispute_reason: reason } }
      );
      const after = await admin.entities.MarketplaceOrder.get(order.id);
      if (after.status !== "disputed") {
        return Response.json({ error: "Litige déjà enregistré." }, { status: 409 });
      }
      await admin.entities.AuditLog.create({
        action: "marketplace_order_disputed",
        admin_email: user.email,
        target_user_id: order.buyer_id,
        target_id: order.id,
        reason,
        details: "Litige ouvert par " + user.email + " sur la commande " + order.order_ref
      });
      const counterpart = isBuyer ? { id: order.seller_id, email: order.seller_email } : { id: order.buyer_id, email: order.buyer_email };
      await Promise.allSettled([
        notifyMember(base44, counterpart,
          "Litige ouvert — " + order.product_name,
          "Un litige a été ouvert sur la commande " + order.order_ref + ". L'administration NOVATRAX l'examine : les fonds restent bloqués jusqu'à la décision."),
        notifyAdmins(base44,
          "Marketplace — litige à examiner (" + order.order_ref + ")",
          "Litige ouvert par " + user.email + " sur la commande " + order.order_ref + " (" + order.product_name + ", " + order.product_price_fcfa + " FCFA).\n\nMotif : " + reason + "\n\nExaminez-le dans l'espace administrateur → Marketplace → Commandes.")
      ]);
      return Response.json({ ok: true, status: "disputed" });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}