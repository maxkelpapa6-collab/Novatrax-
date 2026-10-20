// Règles d'accès aux entités depuis le navigateur. Les fonctions serveur
// (mode service) ne sont pas concernées. Une règle renvoie :
// - true  : accès à tous les documents ;
// - false : accès refusé ;
// - un filtre MongoDB : accès limité aux documents correspondants.
// Toutes les écritures sensibles (transactions, retraits, commandes,
// produits, liens de paiement) passent par les fonctions serveur.

const isAdmin = (u) => !!u && u.role === "admin" && u.account_status !== "suspended";

const PUBLIC = () => true;
const ADMIN = (u) => isAdmin(u);
const NOBODY = () => false;
const ownerOrAdmin = (...fields) => (u) => {
  if (isAdmin(u)) return true;
  if (!u) return false;
  return fields.length === 1 ? { [fields[0]]: u.id } : { $or: fields.map((f) => ({ [f]: u.id })) };
};

const adminOnly = { read: ADMIN, create: ADMIN, update: ADMIN, delete: ADMIN };

export const policies = {
  Application: adminOnly,
  AuditLog: adminOnly,
  Commission: { read: ownerOrAdmin("beneficiary_id"), create: ADMIN, update: ADMIN, delete: ADMIN },
  DepositReview: adminOnly,
  EmailCampaign: adminOnly,
  EmailDeliveryLog: adminOnly,
  Formation: adminOnly,
  InboxMessage: {
    read: ownerOrAdmin("user_id"),
    create: ADMIN,
    update: ownerOrAdmin("user_id"),
    delete: ownerOrAdmin("user_id")
  },
  MarketplaceCategory: { read: PUBLIC, create: ADMIN, update: ADMIN, delete: ADMIN },
  MarketplaceOrder: { read: ownerOrAdmin("buyer_id", "seller_id"), create: ADMIN, update: ADMIN, delete: ADMIN },
  MarketplaceProduct: {
    read: (u) => (isAdmin(u) ? true : u ? { $or: [{ status: "published" }, { seller_id: u.id }] } : { status: "published" }),
    create: ADMIN,
    update: ADMIN,
    delete: ADMIN
  },
  MarketplaceRule: { read: PUBLIC, create: ADMIN, update: ADMIN, delete: ADMIN },
  PaymentLink: { read: PUBLIC, create: ADMIN, update: ADMIN, delete: ADMIN },
  PaymentLinkPayment: { read: ownerOrAdmin("creator_id"), create: ADMIN, update: ADMIN, delete: ADMIN },
  // Relation de parrainage immuable : personne ne la modifie depuis le navigateur.
  Sponsorship: { read: ownerOrAdmin("user_id", "sponsor_id"), create: NOBODY, update: NOBODY, delete: NOBODY },
  Transaction: { read: ownerOrAdmin("user_id"), create: ADMIN, update: ADMIN, delete: ADMIN },
  Withdrawal: { read: ownerOrAdmin("user_id"), create: ADMIN, update: ADMIN, delete: ADMIN },
  // Le membre modifie son propre profil via /api/auth/me, jamais ici.
  User: {
    read: (u) => (isAdmin(u) ? true : u ? { id: u.id } : false),
    create: NOBODY,
    update: ADMIN,
    delete: NOBODY
  }
};

export function ruleFilter(rule, user) {
  if (!rule) return false;
  return rule(user);
}

export function canCreate(rule, user, _data) {
  return ruleFilter(rule, user) === true;
}

// Champs modifiables depuis le navigateur par un non-administrateur.
const MEMBER_UPDATABLE = {
  InboxMessage: ["read", "read_at"]
};

// Champs qu'un administrateur ne modifie jamais directement depuis le navigateur.
const ADMIN_PROTECTED = {
  User: ["email", "role", "referred_by", "referral_code", "password_hash"]
};

export function sanitizeClientUpdate(name, user, data) {
  const patch = { ...(data || {}) };
  if (isAdmin(user)) {
    for (const f of ADMIN_PROTECTED[name] || []) delete patch[f];
    return patch;
  }
  const allowed = MEMBER_UPDATABLE[name] || [];
  for (const key of Object.keys(patch)) if (!allowed.includes(key)) delete patch[key];
  return patch;
}
