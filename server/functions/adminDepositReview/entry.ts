import { createClientFromRequest } from "../../lib/sdk.ts";
import { requireActiveAdmin, logAdminAction } from "../../shared/adminGuard.ts";

const DECISION_ACTIONS = ["confirm_anomaly", "release_commissions", "refuse_claim", "refund_second"];

// Examen administratif des doubles paiements des frais d'accès. Les frais
// d'accès ne génèrent aucune commission : l'administrateur confirme
// l'anomalie, valide le premier paiement, refuse la réclamation, ou
// rembourse / traite le deuxième paiement. Chaque décision est journalisée.
export default async function(req) {
  try {
    const body = await req.json();
    const action = body.action;
    const sdk = createClientFromRequest(req);
    const { user, error } = await requireActiveAdmin(sdk);
    if (error) return error;
    const admin = sdk.asServiceRole;

    if (action === "list") {
      const page = await admin.entities.DepositReview.filter({}, { sort: "-created_date", limit: 50 });
      return Response.json({ ok: true, reviews: page.items || [] });
    }

    if (action === "details") {
      if (!body.id) return Response.json({ error: "Identifiant du dossier requis." }, { status: 400 });
      const review = await admin.entities.DepositReview.get(body.id);
      const txPage = await admin.entities.Transaction.filter(
        { user_id: review.user_id },
        { sort: "-created_date", limit: 50 }
      );
      return Response.json({ ok: true, review: review, transactions: txPage.items || [] });
    }

    if (!DECISION_ACTIONS.includes(action) || !body.id) {
      return Response.json({ error: "Action ou identifiant invalide." }, { status: 400 });
    }

    const note = (body.note || "").trim();
    const review = await admin.entities.DepositReview.get(body.id);
    const now = new Date().toISOString();

    if (action === "confirm_anomaly") {
      if (review.status !== "pending_review") {
        return Response.json({ error: "Ce dossier a déjà été examiné : double décision impossible." }, { status: 409 });
      }
      await admin.entities.DepositReview.update(body.id, {
        status: "anomaly_confirmed",
        decided_by: user.email,
        decided_at: now,
        admin_notes: note || review.admin_notes || null
      });
      await logAdminAction(sdk, {
        action: "deposit_review_confirm_anomaly",
        admin_email: user.email,
        admin_id: user.id,
        target_user_id: review.user_id,
        target_id: body.id,
        reason: note || null,
        details: "Double paiement des frais d'accès confirmé."
      });
      return Response.json({ ok: true, status: "anomaly_confirmed" });
    }

    if (action === "release_commissions") {
      if (review.status !== "pending_review") {
        return Response.json({ error: "Ce dossier a déjà été examiné : double décision impossible." }, { status: 409 });
      }
      const firstTx = await admin.entities.Transaction.get(review.first_tx_id).catch(() => null);
      const member = await admin.entities.User.get(review.user_id).catch(() => null);
      if (!firstTx || !member) {
        return Response.json({ error: "Dépôt initial ou membre introuvable : traitement impossible." }, { status: 404 });
      }
      await admin.entities.User.update(review.user_id, { initial_deposit_status: "CONFIRMED" });
      await admin.entities.DepositReview.update(body.id, {
        status: "commissions_released",
        decided_by: user.email,
        decided_at: now,
        admin_notes: note || review.admin_notes || null
      });
      await logAdminAction(sdk, {
        action: "deposit_review_release_commissions",
        admin_email: user.email,
        admin_id: user.id,
        target_user_id: review.user_id,
        target_id: body.id,
        reason: note || null,
        details: "Premier paiement des frais d'accès validé."
      });
      return Response.json({ ok: true, status: "commissions_released" });
    }

    if (action === "refuse_claim") {
      if (review.status !== "pending_review") {
        return Response.json({ error: "Ce dossier a déjà été examiné : double décision impossible." }, { status: 409 });
      }
      // Réclamation refusée : les deux
      // transactions demeurent conservées avec leurs références.
      await admin.entities.DepositReview.update(body.id, {
        status: "claim_refused",
        decided_by: user.email,
        decided_at: now,
        admin_notes: note || review.admin_notes || null
      });
      await logAdminAction(sdk, {
        action: "deposit_review_refuse_claim",
        admin_email: user.email,
        admin_id: user.id,
        target_user_id: review.user_id,
        target_id: body.id,
        reason: note || null,
        details: "Réclamation de remboursement refusée."
      });
      return Response.json({ ok: true, status: "claim_refused" });
    }

    if (action === "refund_second") {
      if (!note) {
        return Response.json({ error: "Indiquez la référence ou les modalités du remboursement / traitement du deuxième paiement." }, { status: 400 });
      }
      // Le remboursement est enregistré ; les deux transactions sont conservées
      // dans l'historique avec leurs références — aucune suppression.
      await admin.entities.DepositReview.update(body.id, {
        refund_note: note,
        refunded_by: user.email,
        refunded_at: now,
        admin_notes: review.admin_notes || null
      });
      await logAdminAction(sdk, {
        action: "deposit_review_refund_second",
        admin_email: user.email,
        admin_id: user.id,
        target_user_id: review.user_id,
        target_id: body.id,
        reason: note,
        details: "Deuxième paiement remboursé / traité selon la procédure : " + note
      });
      return Response.json({ ok: true, status: "refund_recorded" });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}