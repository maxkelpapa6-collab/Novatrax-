// Intégration LeekPay — logique partagée entre le checkout, le webhook
// et la vérification administrateur. La clé secrète ne quitte jamais le serveur.
export const LEEKPAY_API = "https://leekpay.fr/api/v1";

const PAID_STATUSES = ["paid", "succeeded", "success", "completed", "confirmed"];
const FAILED_STATUSES = ["failed", "canceled", "cancelled", "expired", "rejected", "abandoned"];

export function normalizeStatus(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "unknown";
  if (PAID_STATUSES.includes(s)) return "paid";
  if (FAILED_STATUSES.includes(s)) return "failed";
  if (["pending", "processing", "open", "initiated", "awaiting_payment"].includes(s)) return "pending";
  return "unknown";
}

export async function leekpayRequest(path, options) {
  const opts = options || {};
  const res = await fetch(LEEKPAY_API + path, {
    method: opts.method || "GET",
    headers: {
      "Authorization": "Bearer " + opts.secret,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: AbortSignal.timeout(15000)
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    data = null;
  }
  return { ok: res.ok, status: res.status, data: data };
}

export function extractPaymentUrl(data) {
  if (!data) return null;
  return data.payment_url
    || (data.data && data.data.payment_url)
    || (data.checkout && data.checkout.payment_url)
    || null;
}

export function findTxId(body) {
  if (!body) return null;
  return body.transaction_id
    || (body.metadata && body.metadata.transaction_id)
    || (body.checkout && body.checkout.metadata && body.checkout.metadata.transaction_id)
    || (body.data && (body.data.transaction_id || (body.data.metadata && body.data.metadata.transaction_id)))
    || null;
}

export function findCheckoutId(body) {
  if (!body) return null;
  return body.checkout_id
    || body.id
    || (body.checkout && body.checkout.id)
    || (body.data && (body.data.checkout_id || body.data.id))
    || null;
}

export function findStatus(body) {
  if (!body) return null;
  return body.status
    || body.event
    || (body.checkout && body.checkout.status)
    || (body.data && (body.data.status || (body.data.checkout && body.data.checkout.status)))
    || null;
}

export function findAmount(body) {
  if (!body) return null;
  return body.amount
    || body.amount_fcfa
    || (body.checkout && body.checkout.amount)
    || (body.data && body.data.amount)
    || null;
}

// Vérification directe du statut d'un checkout auprès de LeekPay, avec la clé
// secrète, côté serveur uniquement. Sert de garantie pour le webhook sans
// signature et de contrôle administrateur à la demande.
export async function verifyCheckoutStatus(secret, checkoutId) {
  if (!checkoutId) return { ok: false, status: 0 };
  const res = await leekpayRequest("/checkout/" + encodeURIComponent(checkoutId), { secret: secret });
  if (!res.ok || !res.data) return { ok: false, status: res.status };
  const d = res.data;
  const nested = d.data || null;
  const raw = (nested && (nested.status || nested.payment_status))
    || d.status
    || d.payment_status
    || (d.checkout && d.checkout.status)
    || null;
  const paidAt = (nested && nested.paid_at) || d.paid_at || null;
  let normalized = normalizeStatus(raw);
  // Garantie : un paiement daté par le prestataire fait foi même si le libellé du statut varie
  if (normalized !== "paid" && paidAt) normalized = "paid";
  const amount = (nested && nested.amount) || d.amount || (d.checkout && d.checkout.amount) || null;
  return { ok: true, normalized: normalized, raw_status: raw || null, amount: amount };
}

async function hmac(rawBody, secret, encoding) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const bytes = new Uint8Array(sig);
  if (encoding === "base64") {
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Signature du webhook selon la méthode officielle LeekPay (HMAC-SHA256 du corps
// brut signé avec la clé secrète). Les noms d'en-tête courants sont acceptés ;
// à défaut, la vérification passe par le statut du checkout auprès de l'API.
export async function verifyWebhookSignature(rawBody, headers, secret) {
  const candidates = ["x-leekpay-signature", "leekpay-signature", "x-signature"];
  for (const name of candidates) {
    const provided = headers.get(name);
    if (!provided) continue;
    const value = provided.trim().replace(/^sha256=/i, "").replace(/^sha256:/i, "");
    if (!value) continue;
    const hex = await hmac(rawBody, secret, "hex");
    if (value.toLowerCase() === hex) return true;
    const b64 = await hmac(rawBody, secret, "base64");
    if (value === b64) return true;
  }
  return false;
}

// Transition unique d'un dépôt en attente. Le crédit du portefeuille EST le
// passage du statut « pending » à « confirmed » : cette écriture ne peut donc
// être effectuée qu'une seule fois — les notifications répétées de LeekPay ne
// peuvent jamais créditer deux fois le même dépôt.
export async function settlePendingDeposit(admin, tx, fields) {
  if (tx.status !== "pending") return { updated: false, status: tx.status };
  const $set = { status: fields.status };
  if (fields.note) $set.description = fields.note;
  if (fields.status === "confirmed") $set.confirmed_at = new Date().toISOString();
  await admin.entities.Transaction.updateMany({ id: tx.id, status: "pending" }, { $set: $set });
  const after = await admin.entities.Transaction.get(tx.id);
  return { updated: after.status !== "pending", status: after.status };
}