// Aides partagées pour la gestion des applications APK Pro.

// Résout le mode de téléchargement d'une application (compatibilité :
// les applications créées avant les deux modes sont traitées comme
// « Lien externe », sauf si un fichier APK privé est déjà enregistré).
export function resolveDownloadType(app) {
  if (!app) return "external_link";
  if (app.download_type === "apk_file" || app.download_type === "external_link") return app.download_type;
  if (app.apk_file_uri) return "apk_file";
  return "external_link";
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(1).replace(".", ",") + " Mo";
  if (n >= 1024) return Math.round(n / 1024) + " Ko";
  return n + " octets";
}

export function formatFileDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " à " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export const APK_ACCEPT = ".apk,application/vnd.android.package-archive";

export function isApkFile(file) {
  return !!file && /\.apk$/i.test(file.name);
}