import { useState } from "react";
import { api } from "@/api/client";
import { Smartphone, Download, Link2, FileDown, Pencil, Trash2, ShoppingCart, Power, Loader2, ExternalLink } from "lucide-react";
import { Image } from "@/components/ui/image";
import { useToast } from "@/components/ui/use-toast";
import { resolveDownloadType } from "@/lib/apk";
import ApkFilePanel from "./ApkFilePanel";

// Carte d'application APK Pro, style vitrine : badge « NOUVEAU », bande pastel,
// photo de profil carrée agrandie en surimpression, nom de l'app et étiquette
// de catégorie. Version administrateur : badge du type + gestion du fichier
// et actions de modération conservées sous la carte.
const PASTELS = ["bg-orange-100", "bg-blue-100", "bg-emerald-100", "bg-violet-100"];
const NEW_DAYS = 30;

export default function AppCard({ app, isAdmin, onEdit, onDelete, onTogglePublish, onChanged, variant = 0 }) {
  const { toast } = useToast();
  const type = resolveDownloadType(app);
  const [downloading, setDownloading] = useState(false);

  const isNew =
    app.created_date &&
    Date.now() - new Date(app.created_date).getTime() < NEW_DAYS * 24 * 60 * 60 * 1000;

  // Téléchargement du fichier APK stocké en privé : l'URL signée est générée
  // côté serveur par la fonction protégée apkDownload (accès vérifié).
  const downloadApk = async () => {
    setDownloading(true);
    try {
      const res = await api.functions.invoke("apkDownload", { application_id: app.id });
      const url = res.data?.url;
      if (!url) throw new Error(res.data?.error || "Téléchargement indisponible.");
      const a = document.createElement("a");
      a.href = url;
      a.download = app.apk_file_name || `${app.name}.apk`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast({
        title: "Téléchargement impossible",
        description: e?.response?.data?.error || e?.message || "Une erreur est survenue.",
        variant: "destructive"
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <article className="relative flex flex-col rounded-[20px] bg-card shadow-card hover:shadow-card-hover transition-all overflow-hidden">
      {isNew && (
        <span className="absolute top-2 left-2 z-20 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          Nouveau
        </span>
      )}
      {isAdmin && (
        <span className={`absolute top-2 right-2 z-20 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase text-white ${
          type === "apk_file" ? "bg-violet" : "bg-primary"
        }`}>
          {type === "apk_file" ? <FileDown className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
          {type === "apk_file" ? "APK" : "Lien"}
        </span>
      )}

      {/* Bande pastel avec icône en filigrane */}
      <div className={`relative flex h-20 items-center justify-center ${PASTELS[variant % PASTELS.length]}`}>
        <Smartphone className="h-10 w-10 text-primary/25" strokeWidth={1.5} />
      </div>

      {/* Photo de profil agrandie, en surimpression sur la bande */}
      <div className="relative z-10 -mt-12 flex justify-center">
        <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-card shadow-card">
          {app.logo_image ? (
            <Image src={app.logo_image} fittingType="fill" className="h-full w-full" alt={app.name} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted">
              <Smartphone className="h-8 w-8 text-primary/50" />
            </div>
          )}
        </div>
      </div>

      {/* Nom + sous-titre + description */}
      <div className="px-3 pt-2 text-center">
        <div className="flex items-center justify-center gap-1">
          <h3 className="truncate text-sm font-bold text-foreground">{app.name}</h3>
          {!isAdmin && type === "external_link" && app.download_url && (
            <a href={app.download_url} target="_blank" rel="noopener noreferrer" aria-label="Ouvrir le lien" className="shrink-0 text-muted-foreground hover:text-primary">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{app.price || "Application"}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{app.description}</p>
      </div>

      {/* Étiquette de catégorie */}
      <div className="px-3 pt-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-primary">
          <Smartphone className="h-3 w-3" /> APK Pro
        </span>
      </div>

      {/* Actions membre */}
      {!isAdmin && (
        <div className="flex flex-wrap gap-2 px-3 pb-4 pt-3">
          {type === "apk_file" && app.has_apk_file !== false && (
            <button
              onClick={downloadApk}
              disabled={downloading}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl gradient-novatrax px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {downloading ? "Préparation…" : "Télécharger"}
            </button>
          )}
          {type === "external_link" && app.download_url && (
            <a
              href={app.download_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl gradient-novatrax px-3 py-2 text-xs font-semibold text-white"
            >
              <Download className="h-3.5 w-3.5" /> Télécharger
            </a>
          )}
          {app.purchase_url && (
            <a
              href={app.purchase_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <ShoppingCart className="h-3.5 w-3.5" /> Acheter
            </a>
          )}
        </div>
      )}

      {/* Gestion administrateur */}
      {isAdmin && (
        <div className="px-3 pb-4">
          {type === "apk_file" && <ApkFilePanel app={app} onChanged={onChanged} />}
          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
            <button onClick={() => onEdit(app)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </button>
            <button
              onClick={() => onTogglePublish(app)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${
                app.published ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              }`}
            >
              <Power className="h-3.5 w-3.5" /> {app.published ? "Désactiver" : "Activer"}
            </button>
            <button onClick={() => onDelete(app)} className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 text-destructive px-3 py-1.5 text-xs font-medium hover:bg-destructive/5">
              <Trash2 className="h-3.5 w-3.5" /> Supprimer
            </button>
          </div>
        </div>
      )}
    </article>
  );
}