// Envoi d'e-mails par SMTP (Gmail, Brevo, Mailjet, etc.). Sans configuration
// SMTP, les e-mails sont affichés dans la console du serveur (développement).
import nodemailer from "nodemailer";

let transport = null;

function getTransport() {
  if (transport) return transport;
  if (!process.env.SMTP_HOST) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });
  return transport;
}

export async function sendEmail({ to, subject, html, text, from_name }) {
  if (!to) throw new Error("Destinataire manquant.");
  const t = getTransport();
  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@novatrax.local";
  const from = '"' + (from_name || process.env.SMTP_FROM_NAME || "NOVATRAX") + '" <' + fromAddress + ">";
  if (!t) {
    console.log("[e-mail non envoyé — SMTP non configuré]", { to, subject, text: text || "(html)" });
    return { ok: true, simulated: true };
  }
  await t.sendMail({ from, to, subject, html, text });
  return { ok: true };
}
