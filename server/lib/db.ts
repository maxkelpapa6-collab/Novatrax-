import { MongoClient } from "mongodb";
import { createMemoryDb } from "./memoryDb.ts";

let client = null;
let db = null;

// Sans MONGODB_URL, le serveur démarre en mode test avec une base en mémoire
// (données effacées à chaque redémarrage).
export async function connectDb() {
  if (db) return db;
  const url = process.env.MONGODB_URL;
  if (!url) {
    console.warn("⚠ MONGODB_URL non défini : mode test, base en mémoire (données effacées au redémarrage).");
    db = createMemoryDb();
    return db;
  }
  client = new MongoClient(url);
  await client.connect();
  db = client.db(process.env.MONGODB_DB || "novatrax");
  return db;
}

export function getDb() {
  if (!db) throw new Error("Base de données non connectée.");
  return db;
}

export async function closeDb() {
  if (client) await client.close();
  client = null;
  db = null;
}
