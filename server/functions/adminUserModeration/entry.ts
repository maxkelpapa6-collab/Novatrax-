import { createClientFromRequest } from "../../lib/sdk.ts";
import { requireActiveAdmin, logAdminAction } from "../../shared/adminGuard.ts";

const ACTIONS = ["block", "unblock", "mark_verified", "activate_access"];

export default async function(req) {
  try {
    const body = await req.json();
    const action = body.action;
    const userId = body.user_id;
    const reason = (body.reason || "").trim();
    if (!ACTIONS.includes(action) || !userId) {
      return Response.json({ error: "Action ou identifiant invalide." }, { status: 400 });
    }

    const sdk = createClientFromRequest(req);
    const { user, error } = await requireActiveAdmin(sdk);
    if (error) return error;

    const admin = sdk.asServiceRole;
    const target = await admin.entities.User.get(userId);
    const now = new Date().toISOString();

    if (action === "block") {
      if (target.id === user.id) {
        return Response.json({ error: "Vous ne pouvez pas bloquer votre propre compte administrateur." }, { status: 400 });
      }
      if (!reason) {
        return Response.json({ error: "Un motif administratif est requis pour bloquer un compte." }, { status: 400 });
      }
      await admin.entities.User.update(userId, {
        account_status: "suspended",
        blocked_reason: reason,
        blocked_at: now,
        blocked_by: user.email
      });
      await logAdminAction(sdk, {
        action: "user_block",
        admin_email: user.email,
        admin_id: user.id,
        target_user_id: userId,
        reason: reason,
        details: "Compte bloqué : " + (target.email || userId)
      });
      return Response.json({ ok: true, account_status: "suspended" });
    }

    if (action === "unblock") {
      await admin.entities.User.update(userId, {
        account_status: "active",
        blocked_reason: null,
        blocked_at: null,
        blocked_by: null
      });
      await logAdminAction(sdk, {
        action: "user_unblock",
        admin_email: user.email,
        admin_id: user.id,
        target_user_id: userId,
        reason: reason || null,
        details: "Compte débloqué : " + (target.email || userId)
      });
      return Response.json({ ok: true, account_status: "active" });
    }

    if (action === "activate_access") {
      if (target.role === "admin") {
        return Response.json({ error: "Ce compte administrateur possède déjà tous les accès." }, { status: 400 });
      }
      if (target.access_activated === true) {
        return Response.json({ ok: true, access_activated: true });
      }
      if (!reason) {
        return Response.json({ error: "Un motif est requis pour cette activation exceptionnelle." }, { status: 400 });
      }
      await admin.entities.User.update(userId, {
        access_activated: true,
        access_activated_at: now
      });
      await logAdminAction(sdk, {
        action: "user_access_manual_activate",
        admin_email: user.email,
        admin_id: user.id,
        target_user_id: userId,
        reason: reason,
        details: "Accès Pro activé manuellement sans dépôt : " + (target.email || userId)
      });
      return Response.json({ ok: true, access_activated: true });
    }

    if (action === "mark_verified") {
      if (!reason) {
        return Response.json({ error: "Un motif est requis pour une vérification manuelle exceptionnelle." }, { status: 400 });
      }
      await admin.entities.User.update(userId, { email_verified: true });
      await logAdminAction(sdk, {
        action: "user_email_manual_verify",
        admin_email: user.email,
        admin_id: user.id,
        target_user_id: userId,
        reason: reason,
        details: "Vérification manuelle (décision administrative, distincte de la preuve technique OTP) : " + (target.email || userId)
      });
      return Response.json({ ok: true, email_verified: true });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}