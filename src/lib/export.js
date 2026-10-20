import { getCountry } from "@/lib/countries";

// Convertit une liste d'utilisateurs en CSV (compatible Excel)
export function usersToCSV(users) {
  const headers = ["Nom", "Prénom", "Pays", "Téléphone", "E-mail", "Date d'inscription", "Statut", "Partage"];
  const rows = users.map((u) => {
    const country = getCountry(u.country);
    const d = u.created_date ? new Date(u.created_date) : null;
    const dateStr = d
      ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      : "";
    return [
      u.last_name || "",
      u.first_name || "",
      country ? country.name : u.country || "",
      u.phone || "",
      u.email || "",
      dateStr,
      u.account_status || "active",
      u.share_contacts === true ? "Oui" : "Non",
    ];
  });
  const escape = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
}

// Nom de base du contact : nom complet, sinon nom d'utilisateur
const baseName = (u) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ").trim() ||
  String(u.username || "").trim() ||
  u.full_name ||
  (u.email ? u.email.split("@")[0] : "") ||
  "Membre";

const vcardPhone = (phone) => {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("+") ? cleaned : "+" + cleaned;
};

// Convertit une liste d'utilisateurs en VCF (carnet d'adresses).
// Format obligatoire : [Nom utilisateur] + " Novatrax", numéro E.164.
export function usersToVCF(users) {
  return users
    .map((u) => {
      const lines = ["BEGIN:VCARD", "VERSION:3.0"];
      lines.push(`N:${baseName(u)};Novatrax;;;`);
      lines.push(`FN:${baseName(u)} Novatrax`);
      const phone = vcardPhone(u.phone);
      if (phone) lines.push(`TEL;TYPE=CELL:${phone}`);
      lines.push("END:VCARD");
      return lines.join("\r\n");
    })
    .join("\r\n");
}

export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV(filename, content) {
  // BOM pour qu'Excel reconnaisse l'UTF-8
  downloadFile(filename, "\uFEFF" + content, "text/csv;charset=utf-8;");
}

export function downloadVCF(filename, content) {
  downloadFile(filename, content, "text/vcard;charset=utf-8");
}