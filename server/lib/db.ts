import { MongoClient } from "mongodb";

let client = null;
let db = null;

export async function connectDb() {
  if (db) return db;
  const url = process.env.MONGODB_URL || "mongodb://127.0.0.1:27017";
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
