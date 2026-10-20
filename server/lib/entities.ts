// Stockage des entités dans MongoDB. Chaque entité est une collection ; les
// documents portent `id`, `created_date`, `updated_date` et `created_by`.
// Deux modes d'accès :
// - service (fonctions serveur) : accès complet ;
// - membre (navigateur) : chaque opération est filtrée par les règles
//   d'accès de server/lib/rls.ts.
import { getDb } from "./db.ts";
import { schemas, applyDefaults } from "./schemas.ts";
import { policies, ruleFilter, canCreate, sanitizeClientUpdate } from "./rls.ts";

export class HttpError extends Error {
  status: number;
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Champs internes du compte, jamais renvoyés ni interrogeables depuis le navigateur.
export const HIDDEN_USER_FIELDS = [
  "password_hash", "otp_hash", "otp_expires_at", "otp_attempts", "otp_sent_at",
  "reset_hash", "reset_expires_at"
];

const MAX_LIMIT = 5000;
const DEFAULT_LIMIT = 1000;
const FORBIDDEN_OPERATORS = new Set(["$where", "$function", "$accumulator", "$expr", "$jsonSchema"]);

export function newId() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

function nowIso() {
  return new Date().toISOString();
}

function toOutput(name, doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  if (name === "User") for (const f of HIDDEN_USER_FIELDS) delete rest[f];
  return rest;
}

function parseSort(sort) {
  if (!sort) return { created_date: -1, _id: -1 };
  const out = {};
  for (const part of String(sort).split(",").map((s) => s.trim()).filter(Boolean)) {
    if (part.startsWith("-")) out[part.slice(1)] = -1;
    else out[part.replace(/^\+/, "")] = 1;
  }
  out._id = out._id || 1;
  return out;
}

function encodeCursor(offset) {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) return 0;
  try {
    const o = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8")).o;
    return Number.isInteger(o) && o >= 0 ? o : 0;
  } catch (e) {
    return 0;
  }
}

// Requêtes venant du navigateur : refuse les opérateurs exécutant du code et
// l'interrogation des champs internes du compte.
function assertSafeQuery(name, query) {
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        if (FORBIDDEN_OPERATORS.has(k)) throw new HttpError(400, "Opérateur de requête non autorisé : " + k);
        if (name === "User" && HIDDEN_USER_FIELDS.includes(k)) throw new HttpError(400, "Champ non autorisé : " + k);
        walk(v);
      }
    }
  };
  walk(query);
}

function andQuery(a, b) {
  if (!b || b === true) return a || {};
  if (!a || Object.keys(a).length === 0) return b;
  return { $and: [a, b] };
}

// ctx = { user, service }
export function entityStore(name, ctx) {
  if (!schemas[name]) throw new HttpError(404, "Entité inconnue : " + name);
  const col = () => getDb().collection(name);
  const service = !!ctx.service;
  const user = ctx.user || null;
  const policy = policies[name];

  function access(op) {
    if (service) return {};
    const f = ruleFilter(policy?.[op], user);
    if (f === false) throw new HttpError(user ? 403 : 401, "Accès refusé.");
    return f === true ? {} : f;
  }

  function scoped(op, query) {
    if (!service) assertSafeQuery(name, query || {});
    return andQuery(query || {}, access(op));
  }

  return {
    async filter(query = {}, options: any = {}) {
      const q = scoped("read", query);
      const limit = Math.min(Math.max(1, Number(options.limit) || DEFAULT_LIMIT), MAX_LIMIT);
      const offset = decodeCursor(options.cursor) || Number(options.skip) || 0;
      const docs = await col().find(q).sort(parseSort(options.sort)).skip(offset).limit(limit + 1).toArray();
      const hasMore = docs.length > limit;
      const items = docs.slice(0, limit).map((d) => toOutput(name, d));
      return { items, has_more: hasMore, next_cursor: hasMore ? encodeCursor(offset + limit) : null };
    },

    async list(sort, limit) {
      return this.filter({}, { sort, limit });
    },

    async get(id) {
      const doc = await col().findOne(scoped("read", { id: String(id) }));
      if (!doc) throw new HttpError(404, name + " introuvable.");
      return toOutput(name, doc);
    },

    async count(query = {}) {
      return col().countDocuments(scoped("read", query));
    },

    async create(data = {}) {
      if (!service && !canCreate(policy?.create, user, data)) throw new HttpError(user ? 403 : 401, "Création refusée.");
      const now = nowIso();
      const doc = applyDefaults(name, { ...data });
      delete doc._id;
      doc.id = newId();
      doc.created_date = now;
      doc.updated_date = now;
      doc.created_by = doc.created_by || user?.email || null;
      await col().insertOne({ _id: doc.id, ...doc });
      return toOutput(name, doc);
    },

    async bulkCreate(list = []) {
      const out = [];
      for (const data of list) out.push(await this.create(data));
      return out;
    },

    async update(id, data = {}) {
      const patch = service ? { ...data } : sanitizeClientUpdate(name, user, data);
      delete patch._id;
      delete patch.id;
      delete patch.created_date;
      patch.updated_date = nowIso();
      const res = await col().findOneAndUpdate(
        scoped("update", { id: String(id) }),
        { $set: patch },
        { returnDocument: "after" }
      );
      if (!res) throw new HttpError(404, name + " introuvable.");
      return toOutput(name, res);
    },

    async updateMany(query = {}, update: any = {}) {
      const set = { ...(update.$set || {}) };
      const other = { ...update };
      delete other.$set;
      if (!service && Object.keys(other).length) throw new HttpError(400, "Seul $set est autorisé.");
      const patch = service ? set : sanitizeClientUpdate(name, user, set);
      delete patch._id;
      delete patch.id;
      patch.updated_date = nowIso();
      const res = await col().updateMany(scoped("update", query), { ...other, $set: patch });
      return { matched: res.matchedCount, modified: res.modifiedCount };
    },

    async delete(id) {
      const res = await col().deleteOne(scoped("delete", { id: String(id) }));
      if (!res.deletedCount) throw new HttpError(404, name + " introuvable.");
      return { ok: true };
    },

    async deleteMany(query = {}) {
      const res = await col().deleteMany(scoped("delete", query));
      return { deleted: res.deletedCount };
    },

    // { query, groupBy?, sum?: string | string[] } → { rows: [{ <groupBy>, count, sum_<champ> }] }
    async aggregate(spec: any = {}) {
      const match = scoped("read", spec.query || {});
      const sums = Array.isArray(spec.sum) ? spec.sum : spec.sum ? [spec.sum] : [];
      const group: any = { _id: spec.groupBy ? "$" + spec.groupBy : null, count: { $sum: 1 } };
      for (const f of sums) group["sum_" + f] = { $sum: { $ifNull: ["$" + f, 0] } };
      const rows = await col().aggregate([{ $match: match }, { $group: group }]).toArray();
      return {
        rows: rows.map(({ _id, ...rest }) => (spec.groupBy ? { [spec.groupBy]: _id, ...rest } : rest))
      };
    },

    // Le temps réel est assuré par interrogation périodique côté navigateur.
    subscribe() {
      return () => {};
    }
  };
}

export function entitiesProxy(ctx) {
  return new Proxy({}, {
    get(_t, name) {
      if (typeof name !== "string") return undefined;
      return entityStore(name, ctx);
    }
  });
}

export async function ensureIndexes() {
  const db = getDb();
  for (const name of Object.keys(schemas)) {
    await db.collection(name).createIndex({ id: 1 }, { unique: true });
    await db.collection(name).createIndex({ created_date: -1 });
  }
  await db.collection("User").createIndex({ email: 1 }, { unique: true, sparse: true });
  await db.collection("User").createIndex({ username: 1 }, { sparse: true });
  await db.collection("User").createIndex({ referral_code: 1 }, { sparse: true });
  await db.collection("User").createIndex({ referred_by: 1 });
  for (const name of ["Transaction", "Withdrawal", "InboxMessage"]) {
    await db.collection(name).createIndex({ user_id: 1 });
  }
  await db.collection("Commission").createIndex({ beneficiary_id: 1 });
  await db.collection("Commission").createIndex({ transaction_id: 1, level: 1 });
}
