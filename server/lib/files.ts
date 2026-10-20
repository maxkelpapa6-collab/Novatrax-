// Fichiers envoyés par les membres et l'administration, stockés sur le disque
// du serveur. Publics : servis sous /files/public/<nom>. Privés : accessibles
// uniquement par un lien signé à durée limitée.
import { mkdirSync, existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, extname, resolve } from "node:path";
import { createHmac, timingSafeEqual } from "node:crypto";
import { appUrl } from "./runtime.ts";

export const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR || "./data/uploads");
const PUBLIC_DIR = join(UPLOAD_DIR, "public");
const PRIVATE_DIR = join(UPLOAD_DIR, "private");
mkdirSync(PUBLIC_DIR, { recursive: true });
mkdirSync(PRIVATE_DIR, { recursive: true });

function safeExt(originalName) {
  const ext = extname(originalName || "").toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(ext) ? ext : "";
}

// Formats acceptés : images pour les fichiers publics (jamais de SVG ni de
// HTML, qui pourraient exécuter du code), APK pour les fichiers privés.
const PUBLIC_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];
const PRIVATE_EXTENSIONS = [".apk"];

export function assertAllowedFile(originalName, isPublic) {
  const allowed = isPublic ? PUBLIC_EXTENSIONS : PRIVATE_EXTENSIONS;
  if (!allowed.includes(safeExt(originalName))) {
    throw new Error("Format de fichier non accepté (" + allowed.join(", ") + ").");
  }
}

function fileName(originalName) {
  return crypto.randomUUID().replace(/-/g, "") + safeExt(originalName);
}

function secret() {
  return process.env.FILES_SECRET || process.env.JWT_SECRET || "";
}

function sign(name, exp) {
  return createHmac("sha256", secret()).update(name + ":" + exp).digest("hex");
}

export async function savePublicFile(buffer, originalName) {
  assertAllowedFile(originalName, true);
  const name = fileName(originalName);
  await writeFile(join(PUBLIC_DIR, name), buffer);
  return { file_url: appUrl() + "/files/public/" + name };
}

export async function savePrivateFile(buffer, originalName) {
  assertAllowedFile(originalName, false);
  const name = fileName(originalName);
  await writeFile(join(PRIVATE_DIR, name), buffer);
  return { file_uri: "private/" + name };
}

export function createSignedUrl(fileUri, expiresIn = 300) {
  const name = String(fileUri || "").replace(/^private\//, "");
  if (!/^[a-f0-9]{32}(\.[a-z0-9]{1,8})?$/.test(name)) throw new Error("Fichier invalide.");
  const exp = Math.floor(Date.now() / 1000) + Number(expiresIn || 300);
  return { signed_url: appUrl() + "/files/private/" + name + "?exp=" + exp + "&sig=" + sign(name, exp) };
}

// Renvoie le chemin du fichier privé si la signature est valide et non expirée.
export function verifySignedPath(name, exp, sig) {
  if (!/^[a-f0-9]{32}(\.[a-z0-9]{1,8})?$/.test(name)) return null;
  if (!exp || Number(exp) < Date.now() / 1000) return null;
  const expected = Buffer.from(sign(name, exp));
  const given = Buffer.from(String(sig || ""));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const path = join(PRIVATE_DIR, name);
  return existsSync(path) ? path : null;
}

export const PUBLIC_FILES_DIR = PUBLIC_DIR;
