// Marketplace NOVATRAX — logique serveur partagée : règles de contenu,
// commission 10/90, écritures portefeuille idempotentes et notifications.
// Tous les calculs financiers sont effectués côté serveur uniquement.
import { sendServiceEmail } from "./notify.ts";
import { generateCommissionsForSale, cancelCommissionsForSale } from "./commissions.ts";

export const MARKETPLACE_COMMISSION_RATE = 0.10;
export const MIN_PRODUCT_PRICE_FCFA = 100;
export const MAX_PRODUCT_PRICE_FCFA = 5000000;
export const MAX_DESCRIPTION_CHARS = 500;
export const BLOCKED_LISTINGS_SUSPEND_THRESHOLD = 3;

// Aucun lien externe ne peut figurer dans une annonce : pas de contournement
// du paiement NOVATRAX, pas de redirection WhatsApp / Telegram / autre place.
const LINK_PATTERN = /(https?:\/\/|www\.|wa\.me|chat\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.|bit\.ly|tinyurl\.com|cutt\.ly|is\.gd|goo\.gl|rebrand\.ly|drive\.google|mega\.nz)/i;

export function detectLink(text) {
  return !!text && LINK_PATTERN.test(String(text));
}

export function computeOrderAmounts(priceFcfa) {
  const price = Math.round(Number(priceFcfa));
  const commission = Math.round(price * MARKETPLACE_COMMISSION_RATE);
  return { price_fcfa: price, commission_fcfa: commission, net_fcfa: price - commission };
}

function findForbiddenMatch(text, forbiddenValues) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  for (const raw of forbiddenValues || []) {
    const value = String(raw || "").trim();
    if (value.length >= 3 && lower.includes(value)) return value;
  }
  return null;
}

// Vérification automatique d'une annonce : liens externes, produits interdits,
// cohérence des champs. Renvoie { ok, reason } — la raison est affichée au
// vendeur et journalisée lors d'un blocage.
export function validateProductContent(fields, forbiddenValues) {
  const name = String(fields.name || "").trim();
  const description = String(fields.description || "").trim();
  const price = Math.round(Number(fields.price_fcfa));
  const phone = String(fields.seller_phone || "").trim();
  const category = String(fields.category || "").trim();
  const image = String(fields.image_url || "").trim();

  if (name.length < 3 || name.length > 100) {
    return { ok: false, reason: "Le nom du produit doit contenir entre 3 et 100 caractères." };
  }
  if (description.length > MAX_DESCRIPTION_CHARS) {
    return { ok: false, reason: "La description ne peut pas dépasser " + MAX_DESCRIPTION_CHARS + " caractères." };
  }
  if (detectLink(name) || detectLink(description)) {
    return { ok: false, reason: "Les liens externes sont strictement interdits dans les annonces (sites, WhatsApp, Telegram, raccourcisseurs…). Le numéro de téléphone est le seul canal de contact autorisé." };
  }
  const forbidden = findForbiddenMatch(name + " " + description, forbiddenValues);
  if (forbidden) {
    return { ok: false, reason: "Produit ou service non autorisé sur la Marketplace (« " + forbidden + " »). La revente des produits et services NOVATRAX, ainsi que les produits illégaux ou frauduleux, sont interdits." };
  }
  if (!Number.isFinite(price) || price < MIN_PRODUCT_PRICE_FCFA || price > MAX_PRODUCT_PRICE_FCFA) {
    return { ok: false, reason: "Le prix doit être compris entre " + MIN_PRODUCT_PRICE_FCFA + " et " + MAX_PRODUCT_PRICE_FCFA + " FCFA." };
  }
  const digits = phone.replace(/[^0-9]/g, "");
  if (!/^[+0-9][0-9\s.\-+]{6,19}$/.test(phone) || digits.length < 6 || digits.length > 15 || detectLink(phone)) {
    return { ok: false, reason: "Numéro de téléphone du vendeur invalide : indiquez un numéro que les acheteurs pourront appeler." };
  }
  if (!category) {
    return { ok: false, reason: "Choisissez une catégorie autorisée." };
  }
  if (!image || !/^https?:\/\//i.test(image)) {
    return { ok: false, reason: "La photo du produit est obligatoire." };
  }
  return { ok: true };
}

// Notification membre : message dans la boîte de réception + e-mail de charte.
export async function notifyMember(base44, user, title, text) {
  if (!user || !user.id) return;
  try {
    await base44.asServiceRole.entities.InboxMessage.create({
      user_id: user.id,
      user_email: user.email,
      title,
      body_text: text,
      type: "system"
    });
  } catch (e) { /* la donnée métier reste enregistrée */ }
  await sendServiceEmail(base44, user.email, title, text);
}

// Alerte des administrateurs (modération, litiges, sanctions).
export async function notifyAdmins(base44, title, text) {
  try {
    const page = await base44.asServiceRole.entities.User.filter({ role: "admin" }, { limit: 20 });
    const admins = (page.items || []).filter((a) => a.email);
    await Promise.allSettled(admins.map((a) => sendServiceEmail(base44, a.email, title, text)));
  } catch (e) { /* l'audit log conserve la trace */ }
}

// Paiement confirmé par le prestataire : la commande passe en « en cours ».
// Transition unique : un webhook rejoué ne peut jamais créditer deux fois.
export async function settleMarketplaceOrderPayment(admin, order) {
  if (order.status !== "awaiting_payment") return { updated: false, status: order.status };
  await admin.entities.MarketplaceOrder.updateMany(
    { id: order.id, status: "awaiting_payment" },
    { $set: { status: "processing", paid_at: new Date().toISOString() } }
  );
  const after = await admin.entities.MarketplaceOrder.get(order.id);
  return { updated: after.status === "processing", status: after.status };
}

// Paiement échoué ou abandonné : commande annulée, aucun montant débité.
export async function cancelMarketplaceOrder(admin, order) {
  if (order.status !== "awaiting_payment") return { updated: false, status: order.status };
  await admin.entities.MarketplaceOrder.updateMany(
    { id: order.id, status: "awaiting_payment" },
    { $set: { status: "cancelled" } }
  );
  const after = await admin.entities.MarketplaceOrder.get(order.id);
  return { updated: after.status === "cancelled", status: after.status };
}

// Fin de vente validée : crédit UNIQUE du montant net (90 %) au portefeuille
// du vendeur. L'écriture est garantie unique par sa référence (MKS-<commande>).
export async function completeMarketplaceOrder(base44, admin, order) {
  const ref = "MKS-" + order.id;
  const existing = await admin.entities.Transaction.filter(
    { reference: ref, type: "adjustment", purpose: "marketplace_sale" },
    { limit: 1 }
  );
  let txId = (existing.items || [])[0]?.id || null;
  if (!txId) {
    const tx = await admin.entities.Transaction.create({
      type: "adjustment",
      purpose: "marketplace_sale",
      user_id: order.seller_id,
      user_email: order.seller_email,
      amount_fcfa: order.net_fcfa,
      status: "confirmed",
      method: "marketplace",
      reference: ref,
      description: "Vente Marketplace — " + order.product_name + " (" + order.order_ref + ") : net vendeur 90 % après commission NOVATRAX 10 %."
    });
    txId = tx.id;
  }
  // Commissions d'affiliation sur la vente (prélevées sur la part NOVATRAX).
  try {
    await generateCommissionsForSale(base44, order, txId);
  } catch (e) {
    await admin.entities.AuditLog.create({
      action: "sale_commissions_error",
      admin_email: "system",
      target_id: order.id,
      details: "Échec de génération des commissions pour " + order.order_ref + " : " + (e?.message || e)
    }).catch(() => {});
  }
  await admin.entities.MarketplaceOrder.update(order.id, {
    status: "completed",
    completed_at: new Date().toISOString(),
    sale_transaction_id: txId
  });
  await Promise.allSettled([
    notifyMember(base44, { id: order.seller_id, email: order.seller_email },
      "Vente terminée — " + order.product_name,
      "La commande " + order.order_ref + " est terminée. Net vendeur : " + order.net_fcfa + " FCFA crédités dans votre portefeuille NOVATRAX (commission : " + order.commission_fcfa + " FCFA)."),
    notifyMember(base44, { id: order.buyer_id, email: order.buyer_email },
      "Commande terminée — " + order.product_name,
      "Votre commande " + order.order_ref + " est terminée. Merci d'avoir acheté sur la Marketplace NOVATRAX.")
  ]);
  return { ok: true, sale_transaction_id: txId };
}

// Remboursement administrateur : écritures cohérentes — le crédit vendeur est
// annulé (rejeté, donc retiré du solde disponible) et l'acheteur est remboursé
// du montant payé. Chaque écriture est unique par sa référence.
export async function refundMarketplaceOrder(base44, admin, order, note, adminEmail) {
  if (order.sale_transaction_id) {
    await admin.entities.Transaction.update(order.sale_transaction_id, {
      status: "rejected",
      description: "Vente Marketplace annulée / remboursée (" + order.order_ref + ") — crédit vendeur annulé."
    });
    await cancelCommissionsForSale(admin, order.sale_transaction_id);
  }
  const ref = "MKR-" + order.id;
  const existing = await admin.entities.Transaction.filter(
    { reference: ref, type: "adjustment", purpose: "marketplace_refund" },
    { limit: 1 }
  );
  let refundTxId = (existing.items || [])[0]?.id || null;
  if (!refundTxId) {
    const tx = await admin.entities.Transaction.create({
      type: "adjustment",
      purpose: "marketplace_refund",
      user_id: order.buyer_id,
      user_email: order.buyer_email,
      amount_fcfa: order.product_price_fcfa,
      status: "confirmed",
      method: "marketplace",
      reference: ref,
      description: "Remboursement achat Marketplace — " + order.product_name + " (" + order.order_ref + ")."
    });
    refundTxId = tx.id;
  }
  await admin.entities.MarketplaceOrder.update(order.id, {
    status: "refunded",
    refunded_at: new Date().toISOString(),
    refund_transaction_id: refundTxId,
    resolution_note: note || "Remboursement décidé par l'administration.",
    reviewed_by: adminEmail,
    reviewed_at: new Date().toISOString()
  });
  await Promise.allSettled([
    notifyMember(base44, { id: order.buyer_id, email: order.buyer_email },
      "Remboursement — " + order.product_name,
      "Votre commande " + order.order_ref + " a été remboursée : " + order.product_price_fcfa + " FCFA crédités dans votre portefeuille NOVATRAX."),
    notifyMember(base44, { id: order.seller_id, email: order.seller_email },
      "Vente annulée — " + order.product_name,
      "La commande " + order.order_ref + " a été remboursée à l'acheteur par l'administration. Le crédit vendeur a été annulé.")
  ]);
  return { ok: true, refund_transaction_id: refundTxId };
}