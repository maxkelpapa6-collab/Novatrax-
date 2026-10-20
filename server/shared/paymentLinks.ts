// Liens de paiement NOVATRAX — logique serveur partagée : validation des liens,
// commission 10 %, écritures portefeuille idempotentes. Tous les calculs
// financiers sont effectués côté serveur uniquement, jamais depuis le navigateur.
import { detectLink, notifyMember } from "./marketplace.ts";

export const PAYMENT_LINK_COMMISSION_RATE = 0.10;
export const MIN_LINK_AMOUNT_FCFA = 100;
export const MAX_LINK_AMOUNT_FCFA = 5000000;
export const MAX_LINK_DESCRIPTION_CHARS = 500;

export function computePaymentLinkAmounts(amountFcfa) {
  const amount = Math.round(Number(amountFcfa));
  const commission = Math.round(amount * PAYMENT_LINK_COMMISSION_RATE);
  return { amount_fcfa: amount, commission_fcfa: commission, net_fcfa: amount - commission };
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

// Vérification d'un lien de paiement : nom, description obligatoire, photo,
// bornes de prix cohérentes, aucun lien externe (pas de contournement du
// paiement NOVATRAX), mots-clés interdits partagés avec la Marketplace.
export function validatePaymentLinkContent(fields, forbiddenValues) {
  const name = String(fields.name || "").trim();
  const description = String(fields.description || "").trim();
  const image = String(fields.profile_image || "").trim();
  const priceType = String(fields.price_type || "fixed");

  if (name.length < 3 || name.length > 100) {
    return { ok: false, reason: "Le nom doit contenir entre 3 et 100 caractères." };
  }
  if (!description) {
    return { ok: false, reason: "La description est obligatoire : expliquez aux payeurs ce qu'ils paient." };
  }
  if (description.length > MAX_LINK_DESCRIPTION_CHARS) {
    return { ok: false, reason: "La description ne peut pas dépasser " + MAX_LINK_DESCRIPTION_CHARS + " caractères." };
  }
  if (detectLink(name) || detectLink(description)) {
    return { ok: false, reason: "Les liens externes sont strictement interdits (sites, WhatsApp, Telegram, raccourcisseurs…)." };
  }
  const forbidden = findForbiddenMatch(name + " " + description, forbiddenValues);
  if (forbidden) {
    return { ok: false, reason: "Ce paiement n'est pas autorisé sur NOVATRAX (« " + forbidden + " »). La revente des produits et services NOVATRAX, ainsi que toute activité illégale ou frauduleuse, sont interdits." };
  }
  if (!image || !/^https?:\/\//i.test(image)) {
    return { ok: false, reason: "La photo de profil est obligatoire." };
  }
  if (priceType === "fixed") {
    const price = Math.round(Number(fields.price_fcfa));
    if (!Number.isFinite(price) || price < MIN_LINK_AMOUNT_FCFA || price > MAX_LINK_AMOUNT_FCFA) {
      return { ok: false, reason: "Le prix fixe doit être compris entre " + MIN_LINK_AMOUNT_FCFA + " et " + MAX_LINK_AMOUNT_FCFA + " FCFA." };
    }
  } else if (priceType === "variable") {
    const min = Math.round(Number(fields.min_fcfa));
    const max = Math.round(Number(fields.max_fcfa));
    if (!Number.isFinite(min) || min < MIN_LINK_AMOUNT_FCFA) {
      return { ok: false, reason: "Le montant minimum doit être d'au moins " + MIN_LINK_AMOUNT_FCFA + " FCFA." };
    }
    if (!Number.isFinite(max) || max > MAX_LINK_AMOUNT_FCFA) {
      return { ok: false, reason: "Le montant maximum ne peut pas dépasser " + MAX_LINK_AMOUNT_FCFA + " FCFA." };
    }
    if (min > max) {
      return { ok: false, reason: "Le montant minimum ne peut pas être supérieur au maximum." };
    }
  } else {
    return { ok: false, reason: "Type de prix invalide." };
  }
  return { ok: true };
}

// Paiement confirmé par le prestataire : crédit UNIQUE du montant net (90 %)
// au portefeuille du créateur, puis transition unique du statut. L'écriture est
// garantie unique par sa référence (PLL-<paiement>) : un webhook rejoué ne
// peut jamais créditer deux fois le même paiement.
export async function settlePaymentLinkPayment(admin, payment) {
  if (payment.status !== "awaiting_payment") return { updated: false, status: payment.status };
  const ref = "PLL-" + payment.id;
  const existing = await admin.entities.Transaction.filter(
    { reference: ref, type: "adjustment", purpose: "payment_link" },
    { limit: 1 }
  );
  let txId = (existing.items || [])[0]?.id || null;
  if (!txId) {
    const tx = await admin.entities.Transaction.create({
      type: "adjustment",
      purpose: "payment_link",
      user_id: payment.creator_id,
      user_email: payment.creator_email,
      amount_fcfa: payment.net_fcfa,
      status: "confirmed",
      method: "leekpay",
      reference: ref,
      description: "Paiement reçu via lien de paiement — " + payment.link_name + " (" + payment.payment_ref + ") : net 90 % après commission NOVATRAX 10 %."
    });
    txId = tx.id;
  }
  await admin.entities.PaymentLinkPayment.updateMany(
    { id: payment.id, status: "awaiting_payment" },
    { $set: { status: "completed", paid_at: new Date().toISOString(), credited_transaction_id: txId } }
  );
  const after = await admin.entities.PaymentLinkPayment.get(payment.id);
  return { updated: after.status === "completed", status: after.status, transaction_id: txId };
}

// Paiement échoué ou abandonné : annulé, aucun montant débité.
export async function cancelPaymentLinkPayment(admin, payment) {
  if (payment.status !== "awaiting_payment") return { updated: false, status: payment.status };
  await admin.entities.PaymentLinkPayment.updateMany(
    { id: payment.id, status: "awaiting_payment" },
    { $set: { status: "cancelled" } }
  );
  const after = await admin.entities.PaymentLinkPayment.get(payment.id);
  return { updated: after.status === "cancelled", status: after.status };
}

// Notification du créateur (boîte de réception + e-mail de charte).
export { notifyMember };