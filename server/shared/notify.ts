// Envoi d'e-mail transactionnel via le service intégré (rôle serveur).
// Ne bloque jamais l'opération principale : un échec d'envoi est journalisé
// côté appelant, la donnée métier reste enregistrée.
import { emailShell, textToHtml } from "./emailBranding.ts";
export async function sendServiceEmail(sdk, to, subject, text) {
  if (!to) return false;
  try {
    // Chaque e-mail porte la charte NOVATRAX : logo officiel en en-tête
    await sdk.asServiceRole.integrations.Core.SendEmail({
      to,
      subject,
      html: emailShell(textToHtml(text)),
      text: String(text || "")
    });
    return true;
  } catch (error) {
    return false;
  }
}