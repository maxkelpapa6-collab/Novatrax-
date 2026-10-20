import { createClientFromRequest } from "../../lib/sdk.ts";
import { secrets, appUrl } from "../../lib/runtime.ts";
import { leekpayRequest, extractPaymentUrl } from "../../shared/leekpay.ts";
import { computeOrderAmounts } from "../../shared/marketplace.ts";

// Achat Marketplace : l'acheteur paie par la passerelle existante (LeekPay).
// Le montant et la commission (10 %) sont calculés côté serveur à partir du
// prix du produit : aucune valeur venant du navigateur n'est utilisée.
// Aucun crédit n'est effectué ici — seul le webhook vérifié confirme le
// paiement ; le crédit vendeur (90 %) a lieu à la validation de la vente.
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
    const product = await admin.entities.MarketplaceProduct.get(body.product_id).catch(() => null);
    if (!product || product.status !== "published") {
      return Response.json({ error: "Ce produit n'est plus disponible." }, { status: 404 });
    }
    if (product.seller_id === user.id) {
      return Response.json({ error: "Vous ne pouvez pas acheter votre propre produit." }, { status: 400 });
    }
    const seller = await admin.entities.User.get(product.seller_id).catch(() => null);
    if (!seller || seller.account_status === "suspended" || seller.marketplace_banned === true) {
      return Response.json({ error: "Ce vendeur ne peut plus recevoir de commandes." }, { status: 400 });
    }

    // Anti double-achat : une commande déjà payée ou en cours pour ce produit.
    const activePage = await admin.entities.MarketplaceOrder.filter(
      { buyer_id: user.id, product_id: product.id, status: { $in: ["awaiting_payment", "processing"] } },
      { sort: "-created_date", limit: 1 }
    );
    const active = (activePage.items || [])[0] || null;
    if (active && active.status === "processing") {
      return Response.json({ error: "Vous avez déjà une commande en cours pour ce produit." }, { status: 409 });
    }
    const secret = secrets.get("LEEKPAY_SECRET_KEY");
    if (!secret) {
      return Response.json({ error: "Passerelle de paiement non configurée. Contactez l'administration." }, { status: 500 });
    }
    const origin = appUrl();
    if (!origin) {
      return Response.json({ error: "URL de l'application indisponible. Réessayez." }, { status: 500 });
    }

    // Anti double-clic : un checkout en attente de moins de 60 minutes est
    // réutilisé — un même panier ne crée jamais deux paiements parallèles.
    if (active && active.status === "awaiting_payment" && active.checkout_url) {
      const created = active.created_date ? new Date(active.created_date).getTime() : 0;
      if (created > Date.now() - 60 * 60 * 1000) {
        return Response.json({ ok: true, reused: true, payment_url: active.checkout_url, order_ref: active.order_ref });
      }
    }

    const amounts = computeOrderAmounts(product.price_fcfa);
    const orderRef = "MKT-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
    const order = await admin.entities.MarketplaceOrder.create({
      order_ref,
      product_id: product.id,
      product_name: product.name,
      product_image: product.image_url || null,
      product_price_fcfa: amounts.price_fcfa,
      commission_fcfa: amounts.commission_fcfa,
      net_fcfa: amounts.net_fcfa,
      buyer_id: user.id,
      buyer_email: user.email,
      buyer_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.full_name || user.email,
      buyer_phone: user.phone || "",
      seller_id: product.seller_id,
      seller_email: product.seller_email,
      seller_name: product.seller_name || seller?.full_name || product.seller_email,
      seller_phone: product.seller_phone,
      status: "awaiting_payment"
    });

    const res = await leekpayRequest("/checkout", {
      method: "POST",
      secret: secret,
      body: {
        amount: amounts.price_fcfa,
        currency: "XOF",
        description: "Achat Marketplace NOVATRAX — " + product.name + " — " + orderRef,
        return_url: origin + "/mes-achats?order=" + orderRef + "&result=retour",
        cancel_url: origin + "/mes-achats?order=" + orderRef + "&result=annule",
        webhook_url: origin + "/functions/marketplaceWebhook",
        metadata: { transaction_id: order.id, reference: orderRef }
      }
    });

    const paymentUrl = extractPaymentUrl(res.data);
    if (!res.ok || !paymentUrl) {
      // Aucun paiement n'a été lancé : la commande est annulée, rien n'est débité.
      await admin.entities.MarketplaceOrder.update(order.id, { status: "cancelled" });
      return Response.json({ error: "La création du paiement a échoué. Aucun montant n'a été débité — réessayez." }, { status: 502 });
    }

    let checkoutId = (res.data && (res.data.checkout_id || res.data.id
      || (res.data.data && (res.data.data.checkout_id || res.data.data.id))
      || (res.data.checkout && res.data.checkout.id))) || null;
    if (!checkoutId) {
      const match = String(paymentUrl).match(/(pay_[A-Za-z0-9-]+)/);
      if (match) checkoutId = match[1];
    }
    await admin.entities.MarketplaceOrder.update(order.id, {
      checkout_id: checkoutId,
      checkout_url: paymentUrl,
      payment_reference: orderRef
    });
    await admin.entities.AuditLog.create({
      action: "marketplace_purchase_init",
      admin_email: user.email,
      target_user_id: user.id,
      target_id: order.id,
      details: "Commande " + orderRef + " : " + product.name + " (" + amounts.price_fcfa + " FCFA, commission " + amounts.commission_fcfa + " FCFA)"
    });

    return Response.json({ ok: true, payment_url: paymentUrl, order_ref: orderRef, order_id: order.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}