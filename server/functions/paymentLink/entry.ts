import { createClientFromRequest } from "../../lib/sdk.ts";
import { hasProAccess } from "../../shared/access.ts";
import { validatePaymentLinkContent } from "../../shared/paymentLinks.ts";

// Gestion des liens de paiement par le membre créateur : création,
// modification, pause / réactivation et suppression. Le contenu est vérifié
// côté serveur (liens externes, mots-clés interdits, bornes de prix) — la
// commission de 10 % est appliquée au paiement, jamais au lien.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (user.account_status === "suspended") {
      return Response.json({ error: "Votre compte est bloqué. Contactez le support NOVATRAX." }, { status: 403 });
    }
    const admin = sdk.asServiceRole;
    const action = String(body.action || "create");

    if (action === "create" || action === "update") {
      if (!hasProAccess(user)) {
        return Response.json({ error: "Les liens de paiement sont réservés aux membres actifs. Activez votre accès pour en créer." }, { status: 403 });
      }
      const rulePage = await admin.entities.MarketplaceRule.filter({ active: true }, { limit: 200 });
      const isVariable = body.price_type === "variable";
      const fields = {
        name: body.name,
        description: body.description || "",
        profile_image: body.profile_image,
        price_type: isVariable ? "variable" : "fixed",
        price_fcfa: isVariable ? null : body.price_fcfa,
        min_fcfa: isVariable ? body.min_fcfa : null,
        max_fcfa: isVariable ? body.max_fcfa : null
      };
      const check = validatePaymentLinkContent(fields, (rulePage.items || []).map((r) => r.value));
      if (!check.ok) return Response.json({ error: check.reason }, { status: 400 });

      if (action === "create") {
        const link = await admin.entities.PaymentLink.create({
          ...fields,
          creator_id: user.id,
          creator_email: user.email,
          creator_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.full_name || user.email,
          status: "active"
        });
        await admin.entities.AuditLog.create({
          action: "payment_link_create",
          admin_email: user.email,
          target_user_id: user.id,
          target_id: link.id,
          details: "Lien de paiement créé : " + fields.name + " ("
            + (fields.price_type === "fixed"
              ? fields.price_fcfa + " FCFA fixes"
              : "montant libre " + fields.min_fcfa + "–" + fields.max_fcfa + " FCFA") + ")"
        });
        return Response.json({ ok: true, link_id: link.id });
      }

      const link = await admin.entities.PaymentLink.get(body.link_id).catch(() => null);
      if (!link || (link.creator_id !== user.id && user.role !== "admin")) {
        return Response.json({ error: "Lien de paiement introuvable." }, { status: 404 });
      }
      if (link.status === "blocked") {
        return Response.json({ error: "Ce lien a été bloqué par l'administration. Contactez le support." }, { status: 403 });
      }
      await admin.entities.PaymentLink.update(link.id, { ...fields });
      await admin.entities.AuditLog.create({
        action: "payment_link_update",
        admin_email: user.email,
        target_user_id: user.id,
        target_id: link.id,
        details: "Lien de paiement modifié : " + fields.name
      });
      return Response.json({ ok: true });
    }

    if (action === "toggle") {
      const link = await admin.entities.PaymentLink.get(body.link_id).catch(() => null);
      if (!link || (link.creator_id !== user.id && user.role !== "admin")) {
        return Response.json({ error: "Lien de paiement introuvable." }, { status: 404 });
      }
      if (link.status === "blocked") {
        return Response.json({ error: "Ce lien a été bloqué par l'administration." }, { status: 403 });
      }
      const next = link.status === "active" ? "paused" : "active";
      await admin.entities.PaymentLink.update(link.id, { status: next });
      await admin.entities.AuditLog.create({
        action: "payment_link_toggle",
        admin_email: user.email,
        target_user_id: user.id,
        target_id: link.id,
        details: "Lien « " + link.name + " » " + (next === "active" ? "réactivé" : "mis en pause")
      });
      return Response.json({ ok: true, status: next });
    }

    if (action === "delete") {
      const link = await admin.entities.PaymentLink.get(body.link_id).catch(() => null);
      if (!link || (link.creator_id !== user.id && user.role !== "admin")) {
        return Response.json({ error: "Lien de paiement introuvable." }, { status: 404 });
      }
      await admin.entities.PaymentLink.delete(link.id);
      await admin.entities.AuditLog.create({
        action: "payment_link_delete",
        admin_email: user.email,
        target_user_id: user.id,
        target_id: link.id,
        details: "Lien de paiement supprimé : " + link.name
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}