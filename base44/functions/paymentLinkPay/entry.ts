import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';
import { leekpayRequest, extractPaymentUrl } from "../../shared/leekpay.ts";
import { computePaymentLinkAmounts } from "../../shared/paymentLinks.ts";

// Paiement via lien de paiement : page publique — le payeur n'est pas un membre
// NOVATRAX. Le montant et la commission (10 %) sont calculés côté serveur à
// partir du lien : pour un prix fixe, la valeur du navigateur est ignorée ;
// pour un montant libre, il est encadré par le minimum et le maximum du lien.
// Aucun crédit n'est effectué ici — seul le webhook vérifié confirme le
// paiement et crédite le créateur (90 %).
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;

    const link = await admin.entities.PaymentLink.get(body.link_id).catch(() => null);
    if (!link || link.status !== "active") {
      return Response.json({ error: "Ce lien de paiement n'est pas disponible." }, { status: 404 });
    }
    const creator = await admin.entities.User.get(link.creator_id).catch(() => null);
    if (!creator || creator.account_status === "suspended") {
      return Response.json({ error: "Ce lien ne peut plus recevoir de paiements." }, { status: 400 });
    }

    // Un membre connecté ne peut pas se payer lui-même : la plateforme
    // prélèverait 10 % sans aucun service rendu.
    const user = await base44.auth.me().catch(() => null);
    if (user && user.id === link.creator_id) {
      return Response.json({ error: "Vous ne pouvez pas payer votre propre lien de paiement." }, { status: 400 });
    }

    let amount;
    if (link.price_type === "variable") {
      amount = Math.round(Number(body.amount_fcfa));
      if (!Number.isFinite(amount) || amount < link.min_fcfa || amount > link.max_fcfa) {
        return Response.json({ error: "Le montant doit être compris entre " + link.min_fcfa + " et " + link.max_fcfa + " FCFA." }, { status: 400 });
      }
    } else {
      amount = link.price_fcfa;
    }
    const payerName = String(body.payer_name || "").trim().slice(0, 100) || null;

    const secret = secrets.get("LEEKPAY_SECRET_KEY");
    if (!secret) {
      return Response.json({ error: "Passerelle de paiement non configurée. Contactez l'administration." }, { status: 500 });
    }
    const origin = req.headers.get("X-Base44-App-Url") || "";
    if (!origin) {
      return Response.json({ error: "URL de l'application indisponible. Réessayez." }, { status: 500 });
    }

    const amounts = computePaymentLinkAmounts(amount);
    const ref = "PLP-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    const payment = await admin.entities.PaymentLinkPayment.create({
      payment_ref: ref,
      link_id: link.id,
      link_name: link.name,
      link_image: link.profile_image || null,
      amount_fcfa: amounts.amount_fcfa,
      commission_fcfa: amounts.commission_fcfa,
      net_fcfa: amounts.net_fcfa,
      payer_name: payerName,
      creator_id: link.creator_id,
      creator_email: creator.email,
      status: "awaiting_payment"
    });

    const res = await leekpayRequest("/checkout", {
      method: "POST",
      secret: secret,
      body: {
        amount: amounts.amount_fcfa,
        currency: "XOF",
        description: "Paiement NOVATRAX — " + link.name + " — " + ref,
        return_url: origin + "/p/" + link.id + "?payment=" + ref + "&result=retour",
        cancel_url: origin + "/p/" + link.id + "?payment=" + ref + "&result=annule",
        webhook_url: origin + "/functions/paymentLinkWebhook",
        metadata: { transaction_id: payment.id, reference: ref }
      }
    });

    const paymentUrl = extractPaymentUrl(res.data);
    if (!res.ok || !paymentUrl) {
      // Aucun paiement n'a été lancé : l'écriture est annulée, rien n'est débité.
      await admin.entities.PaymentLinkPayment.update(payment.id, { status: "cancelled" });
      return Response.json({ error: "La création du paiement a échoué. Aucun montant n'a été débité — réessayez." }, { status: 502 });
    }

    let checkoutId = (res.data && (res.data.checkout_id || res.data.id
      || (res.data.data && (res.data.data.checkout_id || res.data.data.id))
      || (res.data.checkout && res.data.checkout.id))) || null;
    if (!checkoutId) {
      const match = String(paymentUrl).match(/(pay_[A-Za-z0-9-]+)/);
      if (match) checkoutId = match[1];
    }
    await admin.entities.PaymentLinkPayment.update(payment.id, {
      checkout_id: checkoutId,
      checkout_url: paymentUrl,
      payment_reference: ref
    });
    await admin.entities.AuditLog.create({
      action: "payment_link_purchase_init",
      admin_email: payerName || "payeur externe",
      target_user_id: link.creator_id,
      target_id: payment.id,
      details: "Paiement initié via lien « " + link.name + " » : " + amounts.amount_fcfa + " FCFA, commission " + amounts.commission_fcfa + " FCFA (" + ref + ")"
    });

    return Response.json({ ok: true, payment_url: paymentUrl, payment_ref: ref });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}