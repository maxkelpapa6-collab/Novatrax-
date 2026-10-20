import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { ACCESS_FEE_FCFA } from "../../shared/wallet.ts";

// Frais d'accès NOVATRAX : premier dépôt obligatoire de 3 000 FCFA via Moneyfusion.
// Le paiement n'est JAMAIS considéré comme réussi parce que l'utilisateur revient
// sur le site : la confirmation vient soit de la notification officielle Moneyfusion
// (fonction moneyfusionIpn), soit d'une décision administratrice journalisée.
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
    const page = await admin.entities.Transaction.filter(
      { user_id: user.id, type: "deposit", purpose: "access_fee" },
      { sort: "-created_date", limit: 1 }
    );
    const existing = (page.items || [])[0] || null;
    const activated = user.access_activated === true;

    const status = {
      activated: activated,
      amount_fcfa: ACCESS_FEE_FCFA,
      pending: (!activated && existing && existing.status === "pending")
        ? { id: existing.id, reference: existing.reference, created_date: existing.created_date }
        : null
    };

    if ((body.action || "status") === "status") {
      return Response.json({ ok: true, ...status });
    }

    if (body.action === "submit") {
      if (activated) {
        return Response.json({ ok: true, ...status, message: "Votre accès est déjà activé." });
      }
      if (existing && existing.status === "pending") {
        return Response.json({ ok: true, ...status, message: "Un dépôt d'accès est déjà en attente de confirmation." });
      }
      const reference = String(body.reference || "").trim();
      if (!reference) {
        return Response.json({ error: "Indiquez la référence du paiement Moneyfusion (reçu, identifiant de transaction)." }, { status: 400 });
      }
      // Anti double-crédit : une même référence ne peut être enregistrée qu'une seule fois
      const dup = await admin.entities.Transaction.filter(
        { purpose: "access_fee", reference },
        { limit: 1 }
      );
      if ((dup.items || []).length > 0) {
        return Response.json({ error: "Cette référence de paiement a déjà été enregistrée. Elle ne peut pas être réutilisée." }, { status: 409 });
      }
      await admin.entities.Transaction.create({
        type: "deposit",
        user_id: user.id,
        user_email: user.email,
        amount_fcfa: ACCESS_FEE_FCFA,
        status: "pending",
        method: "moneyfusion",
        reference: reference,
        purpose: "access_fee",
        description: "Frais d'accès NOVATRAX (3 000 FCFA)"
      });
      // Indicateur de dépôt initial : paiement en attente de confirmation serveur
      if (user.initial_deposit_status !== "CONFIRMED" && user.initial_deposit_status !== "REVIEW_REQUIRED") {
        await admin.entities.User.update(user.id, { initial_deposit_status: "PENDING" });
      }
      const fresh = await admin.entities.Transaction.filter(
        { user_id: user.id, type: "deposit", purpose: "access_fee" },
        { sort: "-created_date", limit: 1 }
      );
      const tx = (fresh.items || [])[0] || null;
      return Response.json({
        ok: true,
        activated: false,
        amount_fcfa: ACCESS_FEE_FCFA,
        pending: tx ? { id: tx.id, reference: tx.reference, created_date: tx.created_date } : null,
        message: "Votre dépôt est enregistré et en attente de confirmation. L'accès sera activé dès la vérification réelle du paiement."
      });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}