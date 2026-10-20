// Comptes membres : inscription avec code de vérification par e-mail,
// connexion par mot de passe (jeton JWT), mot de passe oublié et profil.
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomInt, randomBytes } from "node:crypto";
import { getDb } from "./db.ts";
import { entityStore, newId, HIDDEN_USER_FIELDS } from "./entities.ts";
import { sendEmail } from "./email.ts";
import { appUrl } from "./runtime.ts";
import { emailShell, textToHtml } from "../shared/emailBranding.ts";

const OTP_TTL_MS = 15 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const RESET_TTL_MS = 60 * 60 * 1000;
const TOKEN_TTL = "30d";

// Vérification de l'adresse e-mail par code à l'inscription : désactivée par
// défaut, activée avec REQUIRE_EMAIL_VERIFICATION=true (SMTP nécessaire).
const requireVerification = () => process.env.REQUIRE_EMAIL_VERIFICATION === "true";

// Champs que le membre peut modifier lui-même sur son profil.
const SELF_EDITABLE = ["username", "first_name", "last_name", "full_name", "country", "phone", "share_contacts", "unsubscribed"];

function jwtSecret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error("JWT_SECRET doit être défini (au moins 32 caractères).");
  return s;
}

const users = () => getDb().collection("User");
const sha256 = (v) => createHash("sha256").update(String(v)).digest("hex");
const normEmail = (e) => String(e || "").trim().toLowerCase();

export function publicUser(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  for (const f of HIDDEN_USER_FIELDS) delete rest[f];
  return rest;
}

export function signToken(user) {
  return jwt.sign({ sub: user.id }, jwtSecret(), { expiresIn: TOKEN_TTL });
}

// Membre correspondant au jeton « Authorization: Bearer … » (ou null).
export async function userFromRequest(headers) {
  const raw = typeof headers.get === "function" ? headers.get("authorization") : headers.authorization;
  const m = /^Bearer\s+(.+)$/i.exec(raw || "");
  if (!m) return null;
  try {
    const payload: any = jwt.verify(m[1], jwtSecret());
    const doc = await users().findOne({ id: payload.sub });
    return doc ? publicUser(doc) : null;
  } catch (e) {
    return null;
  }
}

async function sendOtp(doc) {
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  await users().updateOne(
    { id: doc.id },
    { $set: { otp_hash: sha256(code), otp_expires_at: Date.now() + OTP_TTL_MS, otp_attempts: 0, otp_sent_at: Date.now() } }
  );
  const text = "Votre code de vérification NOVATRAX est : " + code + "\n\nCe code expire dans 15 minutes. " +
    "Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.";
  await sendEmail({ to: doc.email, subject: "Votre code de vérification NOVATRAX", text, html: emailShell(textToHtml(text)) });
}

function fail(res, status, error) {
  return res.status(status).json({ error });
}

export function authRouter() {
  const r = Router();

  r.post("/register", async (req, res) => {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, "Adresse e-mail invalide.");
    if (password.length < 8) return fail(res, 400, "Le mot de passe doit contenir au moins 8 caractères.");
    const existing = await users().findOne({ email });
    if (existing && (existing.email_verified || !requireVerification())) {
      return fail(res, 409, "Cette adresse e-mail est déjà utilisée.");
    }
    const password_hash = await bcrypt.hash(password, 12);
    let doc = existing;
    if (existing) {
      // Inscription non vérifiée reprise : nouveau mot de passe, nouveau code.
      await users().updateOne({ id: existing.id }, { $set: { password_hash, updated_date: new Date().toISOString() } });
    } else {
      const now = new Date().toISOString();
      const id = newId();
      doc = { _id: id, id, email, role: "user", email_verified: false, account_status: "active", password_hash, created_date: now, updated_date: now };
      await users().insertOne(doc);
    }
    if (!requireVerification()) return res.json({ ok: true, access_token: signToken(doc) });
    await sendOtp(doc);
    res.json({ ok: true });
  });

  r.post("/verify-otp", async (req, res) => {
    const email = normEmail(req.body?.email);
    const code = String(req.body?.otpCode || req.body?.otp_code || "").trim();
    const doc = await users().findOne({ email });
    if (!doc || !doc.otp_hash) return fail(res, 400, "Code de vérification invalide ou expiré.");
    if ((doc.otp_attempts || 0) >= OTP_MAX_ATTEMPTS || Date.now() > (doc.otp_expires_at || 0)) {
      return fail(res, 400, "Code expiré. Demandez un nouveau code.");
    }
    if (sha256(code) !== doc.otp_hash) {
      await users().updateOne({ id: doc.id }, { $inc: { otp_attempts: 1 } });
      return fail(res, 400, "Code de vérification invalide.");
    }
    await users().updateOne(
      { id: doc.id },
      { $set: { email_verified: true, updated_date: new Date().toISOString() }, $unset: { otp_hash: "", otp_expires_at: "", otp_attempts: "" } }
    );
    res.json({ ok: true, access_token: signToken(doc) });
  });

  r.post("/resend-otp", async (req, res) => {
    const doc = await users().findOne({ email: normEmail(req.body?.email) });
    // Réponse identique que le compte existe ou non.
    if (doc && !doc.email_verified && Date.now() - (doc.otp_sent_at || 0) > OTP_RESEND_MS) await sendOtp(doc);
    res.json({ ok: true });
  });

  r.post("/login", async (req, res) => {
    const email = normEmail(req.body?.email);
    const doc = await users().findOne({ email });
    const ok = doc && doc.password_hash && (await bcrypt.compare(String(req.body?.password || ""), doc.password_hash));
    if (!ok) return fail(res, 401, "Identifiants incorrects.");
    if (!doc.email_verified && requireVerification()) {
      if (Date.now() - (doc.otp_sent_at || 0) > OTP_RESEND_MS) await sendOtp(doc);
      return fail(res, 403, "Adresse e-mail non vérifiée.");
    }
    res.json({ ok: true, access_token: signToken(doc), user: publicUser(doc) });
  });

  r.get("/me", async (req, res) => {
    const user = await userFromRequest(req.headers);
    if (!user) return fail(res, 401, "Non authentifié.");
    res.json(user);
  });

  r.put("/me", async (req, res) => {
    const user = await userFromRequest(req.headers);
    if (!user) return fail(res, 401, "Non authentifié.");
    const patch = {};
    for (const k of SELF_EDITABLE) if (req.body && req.body[k] !== undefined) patch[k] = req.body[k];
    if (patch["username"] !== undefined) {
      const username = String(patch["username"] || "").trim();
      const taken = username && (await users().findOne({ username: { $regex: "^" + username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", $options: "i" }, id: { $ne: user.id } }));
      if (taken) return fail(res, 409, "Ce nom d'utilisateur est déjà pris.");
      patch["username"] = username;
    }
    const updated = await entityStore("User", { service: true }).update(user.id, patch);
    res.json(updated);
  });

  r.post("/reset-request", async (req, res) => {
    const doc = await users().findOne({ email: normEmail(req.body?.email) });
    if (doc) {
      const token = randomBytes(32).toString("hex");
      await users().updateOne({ id: doc.id }, { $set: { reset_hash: sha256(token), reset_expires_at: Date.now() + RESET_TTL_MS } });
      const link = appUrl() + "/reset-password?token=" + token;
      const text = "Vous avez demandé la réinitialisation de votre mot de passe NOVATRAX.\n\n" +
        "Ouvrez ce lien (valable 1 heure) : " + link + "\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.";
      await sendEmail({ to: doc.email, subject: "Réinitialisation de votre mot de passe NOVATRAX", text, html: emailShell(textToHtml(text)) });
    }
    res.json({ ok: true });
  });

  r.post("/reset", async (req, res) => {
    const token = String(req.body?.resetToken || "");
    const password = String(req.body?.newPassword || "");
    if (password.length < 8) return fail(res, 400, "Le mot de passe doit contenir au moins 8 caractères.");
    const doc = token && (await users().findOne({ reset_hash: sha256(token) }));
    if (!doc || Date.now() > (doc.reset_expires_at || 0)) return fail(res, 400, "Lien de réinitialisation invalide ou expiré.");
    await users().updateOne(
      { id: doc.id },
      { $set: { password_hash: await bcrypt.hash(password, 12), email_verified: true }, $unset: { reset_hash: "", reset_expires_at: "" } }
    );
    res.json({ ok: true });
  });

  return r;
}
