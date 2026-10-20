import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { requireActiveAdmin, logAdminAction } from "../../shared/adminGuard.ts";
import { computeAvailableBalance } from "../../shared/wallet.ts";
import { secrets } from 'base44:runtime';
import { verifyCheckoutStatus, settlePendingDeposit } from "../../shared/leekpay.ts";
import { processAccessDepositConfirmed } from "../../shared/commissions.ts";

const WITHDRAWAL_ACTIONS = ["withdrawal_examine", "withdrawal_approve", "withdrawal_reject", "withdrawal_mark_paid"];
const DEPOSIT_ACTIONS = ["deposit_confirm", "deposit_reject", "deposit_verify"];

export default async function(req) {
  try {
    const body = await req.json();
    const action = body.action;
    const id = body.id;
    const note = (body.note || "").trim();
    if (!action || !id) {
      return Response.json({ error: "Action et identifiant requis." }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const { user, error } = await requireActiveAdmin(base44);
    if (error) return error;

    const admin = base44.asServiceRole;
    const now = new Date().toISOString();

    if (WITHDRAWAL_ACTIONS.includes(action)) {
      const w = await admin.entities.Withdrawal.get(id);

      if (action === "withdrawal_examine") {
        if (w.status !== "pending") return Response.json({ error: "Cette demande n'est pas en attente." }, { status: 409 });
        await admin.entities.Withdrawal.update(id, { status: "processing", reviewed_by: user.email, reviewed_at: now });
        return finish("processing");
      }

      if (action === "withdrawal_approve") {
        if (w.status !== "pending" && w.status !== "processing") {
          return Response.json({ error: "Cette demande a déjà été traitée : double validation impossible." }, { status: 409 });
        }
        const balance = await computeAvailableBalance(admin, w.user_id);
        if (balance < w.amount_fcfa) {
          return Response.json({ error: "Solde insuffisant : " + balance + " FCFA disponibles pour " + w.amount_fcfa + " FCFA demandés." }, { status: 409 });
        }
        await admin.entities.Withdrawal.update(id, {
          status: "approved",
          reviewed_by: user.email,
          reviewed_at: now,
          admin_notes: note || w.admin_notes || null
        });
        return finish("approved");
      }

      if (action === "withdrawal_reject") {
        if (w.status !== "pending" && w.status !== "processing" && w.status !== "approved") {
          return Response.json({ error: "Cette demande a déjà été traitée." }, { status: 409 });
        }
        if (!note) return Response.json({ error: "Un motif est requis pour rejeter une demande." }, { status: 400 });
        await admin.entities.Withdrawal.update(id, {
          status: "rejected",
          rejection_reason: note,
          reviewed_by: user.email,
          reviewed_at: now
        });
        return finish("rejected");
      }

      if (action === "withdrawal_mark_paid") {
        if (w.status !== "approved") {
          return Response.json({ error: "Seule une demande approuvée peut être marquée payée." }, { status: 409 });
        }
        if (!note) {
          return Response.json({ error: "Indiquez la référence ou la confirmation du paiement réellement exécuté." }, { status: 400 });
        }
        await admin.entities.Withdrawal.update(id, { status: "paid", paid_at: now, admin_notes: note });
        await admin.entities.Transaction.create({
          type: "withdrawal",
          user_id: w.user_id,
          user_email: w.user_email,
          amount_fcfa: w.amount_fcfa,
          status: "confirmed",
          method: w.payment_method || null,
          reference: w.transaction_ref || null,
          description: "Retrait payé : " + note,
          confirmed_by: user.email,
          confirmed_at: now
        });
        return finish("paid");
      }

      async function finish(newStatus) {
        await logAdminAction(base44, {
          action: action,
          admin_email: user.email,
          admin_id: user.id,
          target_user_id: w.user_id,
          target_id: id,
          reason: note || null
        });
        return Response.json({ ok: true, status: newStatus });
      }
    }

    if (DEPOSIT_ACTIONS.includes(action)) {
      const t = await admin.entities.Transaction.get(id);
      if (t.type !== "deposit") {
        return Response.json({ error: "Cette opération n'est pas un dépôt." }, { status: 400 });
      }
      if (action === "deposit_confirm") {
        // Un dépôt LeekPay ne peut jamais être déclaré payé manuellement :
        // seule la vérification du prestataire confirme le paiement.
        if (t.method === "leekpay") {
          return Response.json({ error: "Un dépôt LeekPay ne peut pas être confirmé manuellement : utilisez « Vérifier auprès de LeekPay » — seul le prestataire confirme le paiement." }, { status: 409 });
        }
        if (t.status !== "pending") return Response.json({ error: "Ce dépôt a déjà été traité." }, { status: 409 });
        await admin.entities.Transaction.update(id, { status: "confirmed", confirmed_by: user.email, confirmed_at: now, reference: note || t.reference || null });
        // Dépôt initial confirmé : activation + commissions d'affiliation (serveur)
        if (t.purpose === "access_fee") {
          await processAccessDepositConfirmed(base44, t);
        }
        await logAdminAction(base44, { action: action, admin_email: user.email, admin_id: user.id, target_user_id: t.user_id, target_id: id, reason: note || null });
        return Response.json({ ok: true, status: "confirmed" });
      }
      if (action === "deposit_verify") {
        if (t.method !== "leekpay") {
          return Response.json({ error: "Seuls les dépôts LeekPay peuvent être vérifiés auprès du prestataire." }, { status: 400 });
        }
        if (t.status !== "pending") return Response.json({ error: "Ce dépôt a déjà été traité." }, { status: 409 });
        const secret = secrets.get("LEEKPAY_SECRET_KEY");
        if (!secret) return Response.json({ error: "Passerelle LeekPay non configurée." }, { status: 500 });
        const verify = await verifyCheckoutStatus(secret, t.checkout_id);
        if (!verify.ok) {
          return Response.json({ error: "LeekPay n'a pas répondu ou le checkout est introuvable. Réessayez plus tard." }, { status: 502 });
        }
        if (verify.normalized === "paid") {
          await settlePendingDeposit(admin, t, { status: "confirmed", note: "Paiement confirmé par vérification serveur LeekPay" });
          await logAdminAction(base44, { action: action, admin_email: user.email, admin_id: user.id, target_user_id: t.user_id, target_id: id, details: "Dépôt confirmé par LeekPay (" + t.reference + ")" });
          // Dépôt initial confirmé : activation + commissions d'affiliation (serveur)
          if (t.purpose === "access_fee") {
            await processAccessDepositConfirmed(base44, t);
          }
          return Response.json({ ok: true, status: "confirmed" });
        }
        if (verify.normalized === "failed") {
          await settlePendingDeposit(admin, t, { status: "rejected", note: "Paiement LeekPay échoué, annulé ou expiré" });
          await logAdminAction(base44, { action: action, admin_email: user.email, admin_id: user.id, target_user_id: t.user_id, target_id: id, details: "Dépôt non abouti selon LeekPay (" + t.reference + ")" });
          return Response.json({ ok: true, status: "rejected" });
        }
        return Response.json({ ok: true, status: "pending", message: "LeekPay indique que le paiement est toujours en attente." });
      }
      if (action === "deposit_reject") {
        if (t.status !== "pending") return Response.json({ error: "Ce dépôt a déjà été traité." }, { status: 409 });
        if (!note) return Response.json({ error: "Un motif est requis pour rejeter un dépôt." }, { status: 400 });
        await admin.entities.Transaction.update(id, { status: "rejected", confirmed_by: user.email, confirmed_at: now, description: note });
        await logAdminAction(base44, { action: action, admin_email: user.email, admin_id: user.id, target_user_id: t.user_id, target_id: id, reason: note });
        return Response.json({ ok: true, status: "rejected" });
      }
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}