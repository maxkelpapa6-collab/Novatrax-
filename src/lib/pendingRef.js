// Conservation du code de parrainage pendant tout le parcours d'inscription.
// Le code survit aux actualisations, à la vérification e-mail et aux redirections ;
// il n'est retiré qu'une fois la relation de parrainage définitivement enregistrée.
const KEY = "novatrax_pending_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

export function readPendingRef() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && raw.code && Date.now() - (raw.savedAt || 0) < TTL_MS) {
      return raw.code;
    }
    if (raw) localStorage.removeItem(KEY);
  } catch {
    // stockage indisponible : le code de l'URL reste utilisable
  }
  return null;
}

export function savePendingRef(code) {
  const clean = (code || "").trim();
  if (!clean) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ code: clean, savedAt: Date.now() }));
  } catch {
    // stockage indisponible
  }
}

export function clearPendingRef() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // stockage indisponible
  }
}