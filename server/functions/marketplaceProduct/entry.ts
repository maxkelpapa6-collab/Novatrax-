import { createClientFromRequest } from "../../lib/sdk.ts";
import { hasProAccess } from "../../shared/access.ts";
import {
  validateProductContent, BLOCKED_LISTINGS_SUSPEND_THRESHOLD
} from "../../shared/marketplace.ts";

// Gestion des annonces par le vendeur : création, modification, suppression.
// Toutes les annonces passent la vérification automatique (liens externes,
// produits interdits) : une infraction certaine bloque l'annonce, journalise
// le motif, alerte l'administration et peut suspendre les récidivistes.
// Une annonce conforme attend la validation administrative avant publication.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (user.account_status === "suspended") {
      return Response.json({ error: "Votre compte est bloqué. Contactez le support NOVATRAX." }, { status: 403 });
    }
    if (user.marketplace_banned === true) {
      return Response.json({ error: "Votre accès à la Marketplace a été retiré définitivement par l'administration." }, { status: 403 });
    }
    const admin = sdk.asServiceRole;
    const action = String(body.action || "create");

    if (action === "create" || action === "update") {
      if (!hasProAccess(user)) {
        return Response.json({ error: "La vente sur la Marketplace est réservée aux membres actifs. Activez votre accès pour publier une annonce." }, { status: 403 });
      }
      const [catPage, rulePage] = await Promise.all([
        admin.entities.MarketplaceCategory.filter({ active: true }, { limit: 100 }),
        admin.entities.MarketplaceRule.filter({ active: true }, { limit: 200 })
      ]);
      const categoryNames = (catPage.items || []).map((c) => c.name);
      const fields = {
        name: body.name,
        description: body.description || "",
        price_fcfa: body.price_fcfa,
        category: body.category,
        seller_phone: body.seller_phone,
        image_url: body.image_url
      };
      if (fields.category && categoryNames.length && !categoryNames.includes(fields.category)) {
        return Response.json({ error: "Cette catégorie n'est pas autorisée." }, { status: 400 });
      }
      const check = validateProductContent(fields, (rulePage.items || []).map((r) => r.value));
      if (!check.ok) {
        if (action === "create") {
          // Infraction détectée avec certitude : l'annonce est créée bloquée,
          // le motif est conservé et l'administration est alertée.
          const product = await admin.entities.MarketplaceProduct.create({
            ...fields,
            seller_id: user.id,
            seller_email: user.email,
            seller_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.full_name || user.email,
            status: "blocked",
            blocked_reason: check.reason
          });
          await admin.entities.AuditLog.create({
            action: "marketplace_product_blocked",
            admin_email: user.email,
            target_user_id: user.id,
            target_id: product.id,
            reason: check.reason,
            details: "Annonce : " + (fields.name || "sans nom")
          });
          const since = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
          const blockedPage = await admin.entities.MarketplaceProduct.filter(
            { seller_id: user.id, status: "blocked", created_date: { $gte: since } },
            { limit: 20 }
          );
          const blockedCount = (blockedPage.items || []).length;
          let suspended = false;
          if (blockedCount >= BLOCKED_LISTINGS_SUSPEND_THRESHOLD && user.role !== "admin") {
            // Infractions répétées : suspension temporaire automatique,
            // réversible par l'administration après examen.
            await admin.entities.User.update(user.id, {
              account_status: "suspended",
              blocked_reason: "Infractions répétées aux règles de la Marketplace (" + blockedCount + " annonces bloquées en 90 jours)."
            });
            suspended = true;
            await admin.entities.AuditLog.create({
              action: "marketplace_seller_auto_suspended",
              admin_email: "marketplace",
              target_user_id: user.id,
              reason: check.reason,
              details: "Compte suspendu automatiquement après " + blockedCount + " annonces bloquées."
            });
          }
          await notifyAdminsViolation(sdk, user, check.reason, blockedCount, suspended);
          return Response.json({ blocked: true, reason: check.reason, suspended }, { status: 200 });
        }
        return Response.json({ error: check.reason }, { status: 400 });
      }

      if (action === "create") {
        const product = await admin.entities.MarketplaceProduct.create({
          ...fields,
          seller_id: user.id,
          seller_email: user.email,
          seller_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.full_name || user.email,
          status: "pending"
        });
        await admin.entities.AuditLog.create({
          action: "marketplace_product_submit",
          admin_email: user.email,
          target_user_id: user.id,
          target_id: product.id,
          details: "Annonce soumise à validation : " + fields.name + " (" + fields.price_fcfa + " FCFA)"
        });
        await notifyAdminsNewListing(sdk, user, fields);
        return Response.json({ ok: true, product_id: product.id, status: "pending" });
      }

      // Modification : le vendeur ne peut modifier que sa propre annonce, et
      // uniquement si aucune commande n'est en cours — le prix payé et le
      // contenu engagé ne doivent jamais changer en cours de vente.
      const product = await admin.entities.MarketplaceProduct.get(body.product_id).catch(() => null);
      if (!product || (product.seller_id !== user.id && user.role !== "admin")) {
        return Response.json({ error: "Annonce introuvable." }, { status: 404 });
      }
      const activePage = await admin.entities.MarketplaceOrder.filter(
        { product_id: product.id, status: { $in: ["awaiting_payment", "processing"] } },
        { limit: 1 }
      );
      if ((activePage.items || []).length) {
        return Response.json({ error: "Impossible de modifier cette annonce : une commande est en cours." }, { status: 409 });
      }
      await admin.entities.MarketplaceProduct.update(product.id, {
        ...fields,
        status: "pending",
        blocked_reason: null,
        rejection_reason: null
      });
      await admin.entities.AuditLog.create({
        action: "marketplace_product_update",
        admin_email: user.email,
        target_user_id: user.id,
        target_id: product.id,
        details: "Annonce modifiée — nouvelle vérification : " + fields.name
      });
      return Response.json({ ok: true, product_id: product.id, status: "pending" });
    }

    if (action === "delete") {
      const product = await admin.entities.MarketplaceProduct.get(body.product_id).catch(() => null);
      if (!product || (product.seller_id !== user.id && user.role !== "admin")) {
        return Response.json({ error: "Annonce introuvable." }, { status: 404 });
      }
      const activePage = await admin.entities.MarketplaceOrder.filter(
        { product_id: product.id, status: { $in: ["awaiting_payment", "processing"] } },
        { limit: 1 }
      );
      if ((activePage.items || []).length) {
        return Response.json({ error: "Impossible de supprimer cette annonce : une commande est en cours." }, { status: 409 });
      }
      await admin.entities.MarketplaceProduct.delete(product.id);
      await admin.entities.AuditLog.create({
        action: "marketplace_product_delete",
        admin_email: user.email,
        target_user_id: user.id,
        target_id: product.id,
        details: "Annonce supprimée : " + product.name
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

async function notifyAdminsViolation(sdk, user, reason, blockedCount, suspended) {
  try {
    const page = await sdk.asServiceRole.entities.User.filter({ role: "admin" }, { limit: 20 });
    const { sendServiceEmail } = await import("../../shared/notify.ts");
    await Promise.allSettled((page.items || []).map((a) => sendServiceEmail(
      sdk, a.email,
      "Marketplace — annonce bloquée (" + (user.email || "") + ")",
      "Une annonce de " + (user.email || "un membre") + " a été bloquée automatiquement.\n\nMotif : " + reason
        + "\nAnnonces bloquées (90 derniers jours) : " + blockedCount
        + (suspended ? "\n\nLe compte a été suspendu automatiquement pour infractions répétées — examinez-le dans l'espace administrateur." : "")
    )));
  } catch (e) { /* l'audit log conserve la trace */ }
}

async function notifyAdminsNewListing(sdk, user, fields) {
  try {
    const page = await sdk.asServiceRole.entities.User.filter({ role: "admin" }, { limit: 20 });
    const { sendServiceEmail } = await import("../../shared/notify.ts");
    await Promise.allSettled((page.items || []).map((a) => sendServiceEmail(
      sdk, a.email,
      "Marketplace — nouvelle annonce à valider",
      "Une nouvelle annonce attend votre validation dans la gestion Marketplace.\n\nVendeur : " + user.email
        + "\nProduit : " + fields.name + "\nPrix : " + fields.price_fcfa + " FCFA\nCatégorie : " + fields.category
    )));
  } catch (e) { /* l'audit log conserve la trace */ }
}