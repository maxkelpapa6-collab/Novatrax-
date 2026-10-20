import { createClientFromRequest } from "../../lib/sdk.ts";
import { secrets, appUrl } from "../../lib/runtime.ts";
import { MIN_DEPOSIT_FCFA, ACCESS_FEE_FCFA } from "../../shared/wallet.ts";
import { leekpayRequest, extractPaymentUrl } from "../../shared/leekpay.ts";

const MAX_DEPOSIT_FCFA = 1000000;

// Dépôt de portefeuille via LeekPay : crée une transaction « en attente »,
// puis un checkout réel auprès de LeekPay et renvoie payment_url vers
// laquelle l'utilisateur est redirigé pour payer. Aucun crédit n'est effectué
// ici : seuls le webhook signé ou la vérification serveur confirment le dépôt.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (user.account_status === "suspended") {
      return Response.json({ error: "Votre compte est bloqué. Contactez le support NOVATRAX." }, { status: 403 });
    }

    // Frais d'accès (3 000 FCFA) : montant imposé par le serveur, jamais choisi
    // ni modifiable depuis le navigateur. Un seul dépôt initial par membre.
    const purpose = body.purpose === "access_fee" ? "access_fee" : "wallet";
    if (purpose === "access_fee" && user.access_activated === true) {
      return Response.json({ error: "Votre accès est déjà activé : aucun nouveau dépôt initial n'est nécessaire." }, { status: 409 });
    }
    const amount = purpose === "access_fee" ? ACCESS_FEE_FCFA : Math.floor(Number(body.amount_fcfa));
    if (purpose !== "access_fee") {
      if (!amount || amount < MIN_DEPOSIT_FCFA) {
        return Response.json({ error: "Le dépôt minimum est de " + MIN_DEPOSIT_FCFA + " FCFA." }, { status: 400 });
      }
      if (amount > MAX_DEPOSIT_FCFA) {
        return Response.json({ error: "Le dépôt maximum est de 1 000 000 FCFA par opération." }, { status: 400 });
      }
    }

    const secret = secrets.get("LEEKPAY_SECRET_KEY");
    if (!secret) {
      return Response.json({ error: "Passerelle de paiement non configurée. Contactez l'administration." }, { status: 500 });
    }

    const admin = sdk.asServiceRole;

    // Anti double-clic / requêtes répétées : un checkout LeekPay en attente de
    // moins de 60 minutes est réutilisé au lieu d'en créer un nouveau.
    const page = await admin.entities.Transaction.filter(
      { user_id: user.id, type: "deposit", method: "leekpay", status: "pending", purpose: purpose },
      { sort: "-created_date", limit: 1 }
    );
    const existing = (page.items || [])[0] || null;
    if (existing && existing.checkout_url) {
      const created = existing.created_date ? new Date(existing.created_date).getTime() : 0;
      if (created > Date.now() - 60 * 60 * 1000) {
        return Response.json({
          ok: true,
          reused: true,
          payment_url: existing.checkout_url,
          reference: existing.reference,
          transaction_id: existing.id
        });
      }
    }

    const origin = appUrl();
    if (!origin) {
      return Response.json({ error: "URL de l'application indisponible. Réessayez." }, { status: 500 });
    }

    const reference = "LP-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    const tx = await admin.entities.Transaction.create({
      type: "deposit",
      user_id: user.id,
      user_email: user.email,
      amount_fcfa: amount,
      status: "pending",
      method: "leekpay",
      purpose: purpose,
      reference: reference,
      description: purpose === "access_fee" ? "Frais d'accès NOVATRAX (3 000 FCFA)" : "Dépôt LeekPay"
    });

    const res = await leekpayRequest("/checkout", {
      method: "POST",
      secret: secret,
      body: {
        amount: amount,
        currency: "XOF",
        description: "Dépôt NOVATRAX — " + reference,
        return_url: origin + "/portefeuille?tx=" + reference + "&result=retour",
        cancel_url: origin + "/portefeuille?tx=" + reference + "&result=annule",
        webhook_url: origin + "/functions/leekpayWebhook",
        metadata: {
          transaction_id: tx.id,
          reference: reference,
          user_id: user.id
        }
      }
    });

    const paymentUrl = extractPaymentUrl(res.data);
    if (!res.ok || !paymentUrl) {
      // Aucun paiement n'a été lancé : la transaction est annulée, rien n'est débité.
      await admin.entities.Transaction.update(tx.id, {
        status: "rejected",
        description: "Création du paiement LeekPay impossible — aucun montant débité."
      });
      return Response.json({ error: "La création du paiement LeekPay a échoué. Aucun montant n'a été débité — réessayez." }, { status: 502 });
    }

    let checkoutId = (res.data && (res.data.checkout_id || res.data.id
      || (res.data.data && (res.data.data.checkout_id || res.data.data.id))
      || (res.data.checkout && res.data.checkout.id))) || null;
    if (!checkoutId) {
      // Repli : l'identifiant du paiement figure dans l'URL de paiement LeekPay
      const match = String(paymentUrl).match(/(pay_[A-Za-z0-9-]+)/);
      if (match) checkoutId = match[1];
    }
    await admin.entities.Transaction.update(tx.id, { checkout_id: checkoutId, checkout_url: paymentUrl });

    // Dépôt initial : l'indicateur du membre passe à PENDING (paiement en
    // attente de la confirmation serveur LeekPay).
    if (purpose === "access_fee" && user.initial_deposit_status !== "CONFIRMED" && user.initial_deposit_status !== "REVIEW_REQUIRED") {
      await admin.entities.User.update(user.id, { initial_deposit_status: "PENDING" });
    }

    return Response.json({ ok: true, payment_url: paymentUrl, reference: reference, transaction_id: tx.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}