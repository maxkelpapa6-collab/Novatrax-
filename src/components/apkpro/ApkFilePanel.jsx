import { useRef, useState } from "react";
import { api } from "@/api/client";
import { FileDown, Upload, Loader2, Trash2, RefreshCw, PackageOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { isApkFile, formatFileSize, formatFileDate, APK_ACCEPT } from "@/lib/apk";

// Gestion du fichier APK d'une application (espace administrateur) :
// nom, taille, date, statut, remplacement et suppression du fichier.
export default function ApkFilePanel({ app, onChanged }) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const uploadFile = async (file, label) => {
    if (!isApkFile(file)) {
      toast({ title: "Fichier invalide", description: "Seuls les fichiers .apk sont acceptés.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { file_uri } = await api.integrations.Core.UploadPrivateFile({ file });
      await api.entities.Application.update(app.id, {
        download_type: "apk_file",
        apk_file_uri: file_uri,
        apk_file_name: file.name,
        apk_file_size: file.size,
        apk_file_date: new Date().toISOString()
      });
      toast({ title: label || "Fichier APK enregistré", description: file.name });
      onChanged();
    } catch (e) {
      toast({ title: "Téléversement impossible", description: e?.response?.data?.error || e?.message || "Erreur", variant: "destructive" });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeFile = async () => {
    if (!confirm(`Supprimer le fichier APK « ${app.apk_file_name || ""} » ? L'application sera conservée sans fichier.`)) return;
    setBusy(true);
    try {
      await api.entities.Application.update(app.id, {
        apk_file_uri: null,
        apk_file_name: null,
        apk_file_size: null,
        apk_file_date: null
      });
      toast({ title: "Fichier APK supprimé" });
      onChanged();
    } catch (e) {
      toast({ title: "Suppression impossible", description: e?.response?.data?.error || e?.message || "Erreur", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const hasFile = !!app.apk_file_uri;

  return (
    <div className="mt-4 rounded-xl border border-violet/25 bg-violet/5 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-violet">
        <FileDown className="h-4 w-4" /> Fichier APK
      </div>
      {hasFile ? (
        <>
          <dl className="mt-3 space-y-1.5 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Nom du fichier</dt><dd className="font-medium text-right truncate max-w-[60%]" title={app.apk_file_name}>{app.apk_file_name}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Taille</dt><dd className="font-medium">{formatFileSize(app.apk_file_size)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Date d'ajout</dt><dd className="font-medium">{formatFileDate(app.apk_file_date)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Statut</dt><dd className="font-medium text-emerald-600 inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Stocké</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet/40 bg-card px-3 py-1.5 text-xs font-semibold text-violet hover:bg-violet/10 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Remplacer le fichier
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={removeFile}
              className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 text-destructive px-3 py-1.5 text-xs font-semibold hover:bg-destructive/5 disabled:opacity-60"
            >
              <Trash2 className="h-3.5 w-3.5" /> Supprimer le fichier
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5"><PackageOpen className="h-3.5 w-3.5" /> Aucun fichier APK téléversé.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg gradient-novatrax px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Téléverser un fichier .apk
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={APK_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) uploadFile(file);
        }}
      />
    </div>
  );
}