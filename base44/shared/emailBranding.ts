// Charte e-mail NOVATRAX : logo officiel + coque HTML commune à tous les e-mails
// envoyés par la plateforme (messages transactionnels et campagnes admin).
export const EMAIL_LOGO_URL = "https://media.base44.com/images/public/6ad0d39326ed4b1a37df4567/ebb8af7fb_408358BC-048B-4229-BF94-04577945B068.png";

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Texte simple -> paragraphes HTML
export function textToHtml(text) {
  const paragraphs = String(text || "").split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const parts = paragraphs.map((p) =>
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#111827">' +
    escapeHtml(p).replace(/\n/g, "<br>") +
    "</p>"
  );
  return parts.join("") || '<p style="margin:0;font-size:15px;line-height:1.65;color:#111827"></p>';
}

// HTML -> texte simple (aperçu dans la boîte de réception)
export function htmlToText(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Coque e-mail : logo NOVATRAX en tête de chaque message envoyé par la plateforme
export function emailShell(contentHtml, options = {}) {
  const title = options.title
    ? '<p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#111827">' + escapeHtml(options.title) + "</p>"
    : "";
  return (
    '<div style="background:#f3f4f6;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:560px;margin:0 auto">' +
    '<div style="background:#ffffff;border-radius:16px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.10)">' +
    '<div style="text-align:center;margin-bottom:28px">' +
    '<img src="' + EMAIL_LOGO_URL + '" width="96" alt="NOVATRAX" style="border-radius:16px;display:inline-block" />' +
    '<p style="margin:12px 0 0;font-size:19px;font-weight:800;letter-spacing:0.02em;color:#111827">NOVA<span style="color:#6C63FF">TRAX</span></p>' +
    "</div>" +
    title +
    (contentHtml || "") +
    "</div>" +
    '<p style="margin:16px 0 0;text-align:center;font-size:12px;color:#6b7280">NOVATRAX — novatraxagencies@gmail.com</p>' +
    "</div></div>"
  );
}