import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import {
  completeMarketplaceOrder, refundMarketplaceOrder, notifyMember, notifyAdmins
} from "../../shared/marketplace.ts";

// Administration Marketplace : modération des annonces (validation, refus,
// masquage, suppression, recours), catégories et règles autorisées, gestion
// des commandes (remboursements, fins de vente, litiges) et sanctions vendeur
// (bannissement Marketplace définitif). Chaque action est journalisée.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Accès réservé aux administrateurs." }, { status: 403 });
    const admin = base44.asServiceRole;
    const adminEmail = user.email;
    const action = String(body.action || "");

    if (action === "product_moderate") {
      const decision = String(body.decision || "");
      const product = await admin.entities.MarketplaceProduct.get(body.product_id).catch(() => null);
      if (!product) return Response.json({ error: "Annonce introuvable." }, { status: 404 });
      const seller = { id: product.seller_id, email: product.seller_email };
      let status = product.status;
      if (decision === "approve") {
        status = "published";
        await admin.entities.MarketplaceProduct.update(product.id, { status, rejection_reason: null, blocked_reason: null });
        await notifyMember(base44, seller, "Annonce publiée — " + product.name,
          "Votre annonce « " + product.name + " » (" + product.price_fcfa + " FCFA) est validée et visible sur la Marketplace NOVATRAX.");
      } else if (decision === "reject") {
        const reason = String(body.reason || "").trim();
        if (reason.length < 5) return Response.json({ error: "Indiquez le motif du refus." }, { status: 400 });
        status = "rejected";
        await admin.entities.MarketplaceProduct.update(product.id, { status, rejection_reason: reason });
        await notifyMember(base44, seller, "Annonce refusée — " + product.name,
          "Votre annonce « " + product.name + " » a été refusée.\n\nMotif : " + reason + "\n\nVous pouvez corriger votre annonce et la soumettre à nouveau.");
      } else if (decision === "hide") {
        status = "hidden";
        await admin.entities.MarketplaceProduct.update(product.id, { status });
      } else if (decision === "show") {
        status = "published";
        await admin.entities.MarketplaceProduct.update(product.id, { status });
      } else if (decision === "unblock") {
        // Recours vendeur : l'annonce repart en vérification manuelle.
        status = "pending";
        await admin.entities.MarketplaceProduct.update(product.id, { status });
        await notifyMember(base44, seller, "Annonce réexaminée — " + product.name,
          "Après recours, votre annonce « " + product.name + " » est à nouveau en attente de validation.");
      } else if (decision === "delete") {
        await admin.entities.MarketplaceProduct.delete(product.id);
      } else {
        return Response.json({ error: "Décision inconnue." }, { status: 400 });
      }
      await admin.entities.AuditLog.create({
        action: "marketplace_admin_product",
        admin_email: adminEmail,
        target_user_id: product.seller_id,
        target_id: product.id,
        reason: body.reason || null,
        details: "Annonce « " + product.name + " » → " + decision + (decision === "delete" ? "" : " (statut : " + status + ")")
      });
      return Response.json({ ok: true });
    }

    if (action === "category_save") {
      const name = String(body.name || "").trim();
      if (name.length < 2 || name.length > 60) {
        return Response.json({ error: "Nom de catégorie invalide (2 à 60 caractères)." }, { status: 400 });
      }
      if (body.id) {
        const cat = await admin.entities.MarketplaceCategory.get(body.id).catch(() => null);
        if (!cat) return Response.json({ error: "Catégorie introuvable." }, { status: 404 });
        await admin.entities.MarketplaceCategory.update(cat.id, { name, active: body.active !== false });
      } else {
        await admin.entities.MarketplaceCategory.create({ name, active: true, sort_order: body.sort_order || 0 });
      }
      await admin.entities.AuditLog.create({
        action: "marketplace_admin_category",
        admin_email: adminEmail,
        details: (body.id ? "Catégorie modifiée : " : "Catégorie créée : ") + name
      });
      return Response.json({ ok: true });
    }

    if (action === "category_delete") {
      const cat = await admin.entities.MarketplaceCategory.get(body.id).catch(() => null);
      if (!cat) return Response.json({ error: "Catégorie introuvable." }, { status: 404 });
      await admin.entities.MarketplaceCategory.delete(cat.id);
      await admin.entities.AuditLog.create({
        action: "marketplace_admin_category",
        admin_email: adminEmail,
        details: "Catégorie supprimée : " + cat.name
      });
      return Response.json({ ok: true });
    }

    if (action === "rule_create") {
      const value = String(body.value || "").trim();
      if (value.length < 3 || value.length > 60) {
        return Response.json({ error: "Mot-clé invalide (3 à 60 caractères)." }, { status: 400 });
      }
      await admin.entities.MarketplaceRule.create({ value, note: body.note || "", active: true });
      await admin.entities.AuditLog.create({
        action: "marketplace_admin_rule",
        admin_email: adminEmail,
        details: "Règle ajoutée : mot-clé interdit « " + value + " »"
      });
      return Response.json({ ok: true });
    }

    if (action === "rule_delete") {
      const rule = await admin.entities.MarketplaceRule.get(body.id).catch(() => null);
      if (!rule) return Response.json({ error: "Règle introuvable." }, { status: 404 });
      await admin.entities.MarketplaceRule.delete(rule.id);
      await admin.entities.AuditLog.create({
        action: "marketplace_admin_rule",
        admin_email: adminEmail,
        details: "Règle supprimée : « " + rule.value + " »"
      });
      return Response.json({ ok: true });
    }

    if (action === "order_resolve") {
      const decision = String(body.decision || "");
      const note = String(body.note || "").trim();
      const order = await admin.entities.MarketplaceOrder.get(body.order_id).catch(() => null);
      if (!order) return Response.json({ error: "Commande introuvable." }, { status: 404 });

      if (decision === "complete") {
        if (!["processing", "disputed"].includes(order.status)) {
          return Response.json({ error: "Cette commande ne peut pas être terminée dans son état actuel." }, { status: 409 });
        }
        if (order.status === "disputed") {
          await admin.entities.MarketplaceOrder.update(order.id, {
            status: "processing", resolution_note: note, reviewed_by: adminEmail, reviewed_at: new Date().toISOString()
          });
        }
        const fresh = await admin.entities.MarketplaceOrder.get(order.id);
        const result = await completeMarketplaceOrder(base44, admin, fresh);
        await admin.entities.AuditLog.create({
          action: "marketplace_admin_order",
          admin_email: adminEmail,
          target_user_id: order.seller_id,
          target_id: order.id,
          details: "Commande " + order.order_ref + " terminée par l'administration — crédit vendeur " + order.net_fcfa + " FCFA"
        });
        return Response.json({ ok: true, sale_transaction_id: result.sale_transaction_id });
      }

      if (decision === "refund") {
        if (!["processing", "completed", "disputed"].includes(order.status)) {
          return Response.json({ error: "Cette commande ne peut pas être remboursée dans son état actuel." }, { status: 409 });
        }
        const result = await refundMarketplaceOrder(base44, admin, order, note, adminEmail);
        await admin.entities.AuditLog.create({
          action: "marketplace_admin_order",
          admin_email: adminEmail,
          target_user_id: order.buyer_id,
          target_id: order.id,
          reason: note || null,
          details: "Commande " + order.order_ref + " remboursée — acheteur crédité " + order.product_price_fcfa + " FCFA, crédit vendeur annulé"
        });
        return Response.json({ ok: true, refund_transaction_id: result.refund_transaction_id });
      }

      return Response.json({ error: "Décision inconnue." }, { status: 400 });
    }

    if (action === "seller_ban") {
      const reason = String(body.reason || "").trim();
      if (reason.length < 5) return Response.json({ error: "Indiquez le motif du bannissement." }, { status: 400 });
      const target = await admin.entities.User.get(body.user_id).catch(() => null);
      if (!target) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
      if (target.role === "admin") return Response.json({ error: "Impossible de bannir un administrateur." }, { status: 400 });
      await admin.entities.User.update(target.id, {
        marketplace_banned: true,
        marketplace_banned_reason: reason,
        marketplace_banned_at: new Date().toISOString(),
        marketplace_banned_by: adminEmail
      });
      // Les annonces publiées du vendeur banni sont retirées de la vitrine.
      await admin.entities.MarketplaceProduct.updateMany(
        { seller_id: target.id, status: "published" },
        { $set: { status: "hidden" } }
      );
      await notifyMember(base44, target, "Accès Marketplace retiré",
        "Votre accès à la Marketplace NOVATRAX a été retiré définitivement par l'administration.\n\nMotif : " + reason + "\n\nVous pouvez contacter le support pour toute question.");
      await admin.entities.AuditLog.create({
        action: "marketplace_admin_seller_ban",
        admin_email: adminEmail,
        target_user_id: target.id,
        reason,
        details: "Bannissement Marketplace définitif de " + target.email
      });
      return Response.json({ ok: true });
    }

    if (action === "seller_unban") {
      const target = await admin.entities.User.get(body.user_id).catch(() => null);
      if (!target) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });
      await admin.entities.User.update(target.id, { marketplace_banned: false, marketplace_banned_reason: null });
      await notifyMember(base44, target, "Accès Marketplace rétabli",
        "Votre accès à la Marketplace NOVATRAX a été rétabli par l'administration.");
      await admin.entities.AuditLog.create({
        action: "marketplace_admin_seller_unban",
        admin_email: adminEmail,
        target_user_id: target.id,
        details: "Rétablissement de l'accès Marketplace de " + target.email
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}