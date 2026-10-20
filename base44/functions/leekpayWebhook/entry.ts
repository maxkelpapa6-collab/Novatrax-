import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import {
  normalizeStatus, verifyWebhookSignature, verifyCheckoutStatus,
  settlePendingDeposit, findTxId, findCheckoutId, findStatus, findAmount
} from "../../shared/leekpay.ts";
import { processAccessDepositConfirmed } from "../../shared/commissions.ts";

// Webhook LeekPay : confirmation réelle des dépôts. Aucun crédit n'est effectué
// parce que l'utilisateur revient sur le site : seules comptent
// 1) une signature HMAC valide signée avec la clé secrète, ou
// 2) une vérification directe du statut du checkout auprès de LeekPay.
// Toute notification non authentifiable est rejetée et rejouable par LeekPay.
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

    const txId = findTxId(body);
    if (!txId) return Response.json({ error: "Transaction inconnue." }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;

    // Authentificité de la notification
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

    let tx = null;
    try {
      tx = await admin.entities.Transaction.get(txId);
    } catch (e) {
      tx = null;
    }
    if (!tx || tx.type !== "deposit" || tx.method !== "leekpay" || (tx.purpose !== "wallet" && tx.purpose !== "access_fee")) {
      return Response.json({ error: "Transaction introuvable." }, { status: 404 });
    }
    // Idempotence : une notification rejouée sur un dépôt déjà traitée est acquittée sans effet.
    if (tx.status !== "pending") {
      return Response.json({ received: true, ignored: "already_settled" });
    }

    // Montant : toute différence entre le paiement et la demande bloque le crédit.
    const evAmount = findAmount(body);
    if (evAmount != null && Math.round(Number(evAmount)) !== tx.amount_fcfa) {
      await admin.entities.AuditLog.create({
        action: "leekpay_webhook",
        admin_email: "leekpay",
        result: "error",
        target_user_id: tx.user_id,
        target_id: tx.id,
        reason: "Montant du paiement différent du montant demandé (" + evAmount + " vs " + tx.amount_fcfa + ")"
      });
      return Response.json({ error: "Montant incompatible avec la transaction." }, { status: 400 });
    }

    // Statut : pour une notification signée, on fait confiance au statut transmis ;
    // sinon, seul le statut renvoyé par l'API LeekPay fait foi.
    let normalized = signed ? normalizeStatus(findStatus(body)) : apiVerified.normalized;

    if (normalized === "paid") {
      await settlePendingDeposit(admin, tx, {
        status: "confirmed",
        note: "Paiement LeekPay confirmé par le prestataire"
      });
      await admin.entities.AuditLog.create({
        action: "leekpay_webhook",
        admin_email: "leekpay",
        target_user_id: tx.user_id,
        target_id: tx.id,
        details: "Dépôt confirmé (" + tx.reference + ", " + tx.amount_fcfa + " FCFA), vérifié via " + provider
      });
      // Dépôt initial (frais d'accès 3 000 FCFA) : activation de l'accès et
      // moteur de commissions d'affiliation, côté serveur uniquement.
      if (tx.purpose === "access_fee") {
        await processAccessDepositConfirmed(base44, tx);
      }
    } else if (normalized === "failed") {
      await settlePendingDeposit(admin, tx, {
        status: "rejected",
        note: "Paiement LeekPay échoué, annulé ou expiré"
      });
      await admin.entities.AuditLog.create({
        action: "leekpay_webhook",
        admin_email: "leekpay",
        target_user_id: tx.user_id,
        target_id: tx.id,
        details: "Dépôt non abouti (" + tx.reference + ")"
      });
      // Un dépôt d'accès abandonné remet l'indicateur à NOT_PAID tant qu'aucun
      // dépôt initial n'est confirmé côté serveur.
      if (tx.purpose === "access_fee") {
        const u = await admin.entities.User.get(tx.user_id).catch(() => null);
        if (u && u.initial_deposit_status === "PENDING") {
          const page = await admin.entities.Transaction.filter(
            { user_id: u.id, type: "deposit", purpose: "access_fee", status: "confirmed" },
            { limit: 1 }
          );
          if (!(page.items || []).length) {
            await admin.entities.User.update(u.id, { initial_deposit_status: "NOT_PAID" });
          }
        }
      }
    }
    // pending / unknown : aucun changement, le dépôt reste « en attente ».

    return Response.json({ received: true, status: normalized });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}