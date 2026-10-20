// Répertoire de contacts NOVATRAX — logique partagée côté serveur.
// Fuseau horaire de référence de la plateforme (Afrique de l'Ouest, UTC+0).
export const CONTACTS_TZ = "Africa/Lome";
const DAY_MS = 86400000;

function tzParts(date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: CONTACTS_TZ,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const map = {};
  for (const p of dtf.formatToParts(date)) map[p.type] = p.value;
  return {
    y: Number(map.year), m: Number(map.month), d: Number(map.day),
    h: map.hour === "24" ? 0 : Number(map.hour),
    min: Number(map.minute), sec: Number(map.second),
  };
}

function tzOffsetMs(date) {
  const p = tzParts(date);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.sec) - date.getTime();
}

// Instant UTC du minuit local (fuseau NOVATRAX) du jour de la date donnée.
function localDayStart(date) {
  const p = tzParts(date);
  const guess = Date.UTC(p.y, p.m - 1, p.d);
  return guess - tzOffsetMs(new Date(guess));
}

const isIsoDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Filtre created_date correspondant à la période demandée (bornes locales NOVATRAX).
export function resolveRangeQuery(range, dateFrom, dateTo) {
  const r = String(range || "all").toLowerCase();
  const now = new Date();
  const todayStart = localDayStart(now);
  const gte = (t) => ({ created_date: { $gte: new Date(t).toISOString() } });
  if (r === "today") {
    return {
      created_date: {
        $gte: new Date(todayStart).toISOString(),
        $lt: new Date(todayStart + DAY_MS).toISOString(),
      },
    };
  }
  if (r === "yesterday") {
    return {
      created_date: {
        $gte: new Date(todayStart - DAY_MS).toISOString(),
        $lt: new Date(todayStart).toISOString(),
      },
    };
  }
  if (r === "week") {
    const p = tzParts(now);
    const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
    const monday = todayStart - ((dow + 6) % 7) * DAY_MS;
    return gte(monday);
  }
  if (r === "month") {
    const p = tzParts(now);
    const guess = Date.UTC(p.y, p.m - 1, 1);
    return gte(guess - tzOffsetMs(new Date(guess)));
  }
  if (r === "custom") {
    const q = {};
    if (isIsoDate(dateFrom)) {
      const [y, m, d] = dateFrom.split("-").map(Number);
      const g = Date.UTC(y, m - 1, d);
      q.$gte = new Date(g - tzOffsetMs(new Date(g))).toISOString();
    }
    if (isIsoDate(dateTo)) {
      const [y, m, d] = dateTo.split("-").map(Number);
      const g = Date.UTC(y, m - 1, d);
      q.$lt = new Date(g - tzOffsetMs(new Date(g)) + DAY_MS).toISOString();
    }
    return Object.keys(q).length ? { created_date: q } : {};
  }
  return {};
}

// Compteurs par période, calculés sur la liste des contacts éligibles.
export function countByRanges(members) {
  const now = new Date();
  const todayStart = localDayStart(now);
  const p = tzParts(now);
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  const weekStart = todayStart - ((dow + 6) % 7) * DAY_MS;
  const monthGuess = Date.UTC(p.y, p.m - 1, 1);
  const monthStart = monthGuess - tzOffsetMs(new Date(monthGuess));
  const counts = { total: 0, today: 0, yesterday: 0, week: 0, month: 0 };
  for (const m of members) {
    counts.total++;
    const t = m.created_date ? new Date(m.created_date).getTime() : 0;
    if (t >= todayStart && t < todayStart + DAY_MS) counts.today++;
    if (t >= todayStart - DAY_MS && t < todayStart) counts.yesterday++;
    if (t >= weekStart) counts.week++;
    if (t >= monthStart) counts.month++;
  }
  return counts;
}

// Nom de base du contact : nom complet, sinon nom d'utilisateur.
export function contactBaseName(u) {
  const full = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return full || String(u.username || "").trim() || String(u.full_name || "").trim() || "Membre";
}

// Format obligatoire : [Nom utilisateur] + " Novatrax"
export function contactDisplayName(u) {
  return contactBaseName(u) + " Novatrax";
}

// Normalisation E.164 : indicatif international conservé, espaces retirés.
export function normalizePhone(phone) {
  const cleaned = String(phone || "").replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  return cleaned.startsWith("+") ? cleaned : "+" + cleaned;
}

// Éligible au répertoire : consentement explicite + numéro présent + compte actif.
export function eligibleContactMember(u) {
  return !!u && u.share_contacts === true && !!u.phone && (u.account_status || "active") !== "suspended";
}

// Aucun doublon : un enregistrement par identifiant unique.
export function dedupeById(list) {
  const seen = new Set();
  return (list || []).filter((u) => {
    if (!u || !u.id || seen.has(u.id)) return false;
    seen.add(u.id);
    return true;
  });
}

function vcardEscape(v) {
  return String(v == null ? "" : v)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Fichier vCard standard (VERSION:3.0), compatible iPhone, Android, Samsung,
// Google Contacts et tous les carnets d'adresses compatibles vCard.
export function buildVcf(members) {
  const cards = [];
  for (const m of members) {
    const base = contactBaseName(m);
    const name = base + " Novatrax";
    const phone = normalizePhone(m.phone);
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      "N:" + vcardEscape(base) + ";Novatrax;;;",
      "FN:" + vcardEscape(name),
      "TEL;TYPE=CELL:" + phone,
      "END:VCARD",
    ];
    cards.push(lines.join("\r\n"));
  }
  return cards.join("\r\n");
}

// Export CSV réservé à l'administration (BOM UTF-8, séparateur « ; »).
export function buildContactsCsv(members) {
  const esc = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  const rows = members.map((m) => [
    contactDisplayName(m),
    normalizePhone(m.phone),
    m.created_date || "",
    m.country || "",
  ].map(esc).join(";"));
  return "\uFEFF" + ["Nom du contact;Telephone;Date d'inscription;Pays", ...rows].join("\r\n");
}