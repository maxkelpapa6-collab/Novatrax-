// Base de données en mémoire (mode test) : utilisée quand MONGODB_URL n'est
// pas défini. Elle reproduit les opérations MongoDB utilisées par le serveur.
// Les données sont perdues à chaque redémarrage du serveur.
import { find, aggregate, updateMany as mingoUpdateMany } from "mingo";

const clone = (v) => (v === undefined ? v : structuredClone(v));

function duplicateKeyError(keys) {
  const err: any = new Error("E11000 duplicate key error: " + JSON.stringify(keys));
  err.code = 11000;
  return err;
}

class MemoryCursor {
  docs: any[];
  constructor(docs) {
    this.docs = docs;
  }
  private sortSpec = null;
  private skipN = 0;
  private limitN = 0;
  sort(spec) {
    this.sortSpec = spec;
    return this;
  }
  skip(n) {
    this.skipN = n;
    return this;
  }
  limit(n) {
    this.limitN = n;
    return this;
  }
  async toArray() {
    let cursor = find(this.docs, {});
    if (this.sortSpec) cursor = cursor.sort(this.sortSpec);
    if (this.skipN) cursor = cursor.skip(this.skipN);
    if (this.limitN) cursor = cursor.limit(this.limitN);
    return cursor.all().map(clone);
  }
}

class MemoryCollection {
  docs: any[] = [];
  uniqueKeys: string[][] = [];

  private matching(query) {
    return find(this.docs, query || {}).all();
  }

  private assertUnique(candidate, ignore = null) {
    for (const keys of this.uniqueKeys) {
      if (keys.some((k) => candidate[k] === undefined || candidate[k] === null)) continue;
      const clash = this.docs.find((d) => d !== ignore && keys.every((k) => d[k] === candidate[k]));
      if (clash) throw duplicateKeyError(keys);
    }
  }

  async createIndex(spec, options: any = {}) {
    if (options.unique) this.uniqueKeys.push(Object.keys(spec));
    return Object.keys(spec).join("_");
  }

  find(query = {}) {
    return new MemoryCursor(this.matching(query));
  }

  async findOne(query = {}) {
    return clone(this.matching(query)[0] || null);
  }

  async countDocuments(query = {}) {
    return this.matching(query).length;
  }

  async insertOne(doc) {
    const copy = clone(doc);
    this.assertUnique(copy);
    this.docs.push(copy);
    return { acknowledged: true, insertedId: copy._id };
  }

  private applyUpdate(targets, update) {
    let modified = 0;
    for (const doc of targets) {
      const before = JSON.stringify(doc);
      const holder = [clone(doc)];
      mingoUpdateMany(holder, {}, update);
      const next = holder[0];
      this.assertUnique(next, doc);
      Object.keys(doc).forEach((k) => delete doc[k]);
      Object.assign(doc, next);
      if (JSON.stringify(doc) !== before) modified++;
    }
    return modified;
  }

  async updateOne(query, update) {
    const target = this.matching(query).slice(0, 1);
    const modified = this.applyUpdate(target, update);
    return { matchedCount: target.length, modifiedCount: modified };
  }

  async updateMany(query, update) {
    const targets = this.matching(query);
    const modified = this.applyUpdate(targets, update);
    return { matchedCount: targets.length, modifiedCount: modified };
  }

  async findOneAndUpdate(query, update, options: any = {}) {
    const target = this.matching(query)[0];
    if (!target) return null;
    const before = clone(target);
    this.applyUpdate([target], update);
    return options.returnDocument === "after" ? clone(target) : before;
  }

  async deleteOne(query) {
    const target = this.matching(query)[0];
    if (!target) return { deletedCount: 0 };
    this.docs.splice(this.docs.indexOf(target), 1);
    return { deletedCount: 1 };
  }

  async deleteMany(query) {
    const targets = new Set(this.matching(query));
    this.docs = this.docs.filter((d) => !targets.has(d));
    return { deletedCount: targets.size };
  }

  aggregate(pipeline) {
    const rows = aggregate(this.docs, pipeline);
    return { toArray: async () => rows.map(clone) };
  }
}

export function createMemoryDb() {
  const collections = new Map();
  return {
    collection(name) {
      if (!collections.has(name)) collections.set(name, new MemoryCollection());
      return collections.get(name);
    }
  };
}
