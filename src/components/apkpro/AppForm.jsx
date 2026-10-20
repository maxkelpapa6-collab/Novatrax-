import { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Save, Loader2, Link2, FileDown, ImagePlus, Upload } from "lucide-react";
import { Image } from "@/components/ui/image";
import { resolveDownloadType, isApkFile, formatFileSize, APK_ACCEPT } from "@/lib/apk";

// Formulaire administrateur : création / modification d'une application APK Pro
// avec deux modes de téléchargement — « Lien externe » ou « Fichier APK »
// (téléversé et stocké en privé, seule la référence de stockage est enregistrée).
export default function AppForm({ application, onClose, onSaved }) {
  const existingType = resolveDownloadType(application);
  const [form, setForm] = useState({
    name: application?.name || "",
    description: application?.description || "",
    logo_image: application?.logo_image || "",
    features: application?.features || "",
    price: application?.price || "",
    download_type: existingType,
    download_url: application?.download_url || "",
    purchase_url: application?.purchase_url || "",
    published: application?.published ?? false
  });
  const [imageFile, setImageFile] = useState(null);
  const [apkFile, setApkFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const imageInputRef = useRef(null);
  const apkInputRef = useRef(null);

  const hasExistingApk = !!application?.apk_file_uri;

  const setType = (t) => setForm((f) => ({ ...f, download_type: t }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim() || !form.description.trim()) {
      setError("Le nom et la description sont obligatoires.");
      return;
    }
    if (form.download_type === "external_link" && !form.download_url.trim()) {
      setError("Le lien de téléchargement est obligatoire pour le mode « Lien externe ».");
      return;
    }
    if (form.download_type === "apk_file" && !hasExistingApk && !apkFile) {
      setError("Veuillez téléverser un fichier .apk.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };

      // Image de profil / icône : téléversement public (affichée à tous les membres)
      if (imageFile) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: imageFile });
        payload.logo_image = file_url;
      }
      // Fichier APK : téléversement privé — on enregistre la référence réelle
      // du stockage (file_uri), jamais un simple nom de fichier.
      if (form.download_type === "apk_file" && apkFile) {
        if (!isApkFile(apkFile)) throw new Error("Seuls les fichiers .apk sont acceptés.");
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file: apkFile });
        payload.apk_file_uri = file_uri;
        payload.apk_file_name = apkFile.name;
        payload.apk_file_size = apkFile.size;
        payload.apk_file_date = new Date().toISOString();
      }

      if (application?.id) {
        await base44.entities.Application.update(application.id, payload);
      } else {
        await base44.entities.Application.create(payload);
      }
      onSaved();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "";
      if (msg.toLowerCase().includes("not allowed") || msg.toLowerCase().includes(".apk")) {
        setError("Le stockage de la plateforme refuse les fichiers .apk (sécurité anti-virus). Solution : utilisez le mode « Lien externe » avec un lien de téléchargement (MediaFire, Google Drive…), ou déposez le fichier renommé en .zip.");
      } else {
        setError(msg || "Enregistrement impossible.");
      }
    } finally {
      setSaving(false);
    }
  };

  const typeButton = (value, icon, label, desc) => (
    <button
      key={value}
      type="button"
      onClick={() => setType(value)}
      className={`rounded-xl border-2 p-3 text-left transition-all ${
        form.download_type === value ? "border-violet bg-violet/5" : "border-border hover:border-violet/40"
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon} {label}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl shadow-card-hover max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card flex items-center justify-between px-5 py-4 border-b border-border z-10">
          <h2 className="font-heading text-lg font-bold">{application ? "Modifier l'application" : "Nouvelle application"}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="Type de téléchargement">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {typeButton("external_link", <Link2 className="h-4 w-4 text-primary" />, "Lien externe", "Le bouton ouvre un lien configuré")}
              {typeButton("apk_file", <FileDown className="h-4 w-4 text-violet" />, "Fichier APK", "Fichier .apk téléversé et stocké")}
            </div>
          </Field>

          <Field label="Nom de l'application *">
            <input className="f-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Outil Pro" />
          </Field>

          <Field label="Image de profil / icône">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 rounded-2xl overflow-hidden bg-muted/40 flex items-center justify-center border border-border">
                {imageFile ? (
                  <img src={URL.createObjectURL(imageFile)} className="h-full w-full object-cover" alt="Aperçu" />
                ) : form.logo_image ? (
                  <Image src={form.logo_image} fittingType="fill" className="h-full w-full" alt={form.name} />
                ) : (
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <button type="button" onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted">
                <Upload className="h-3.5 w-3.5" /> {form.logo_image || imageFile ? "Remplacer l'image" : "Choisir une image"}
              </button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setImageFile(f);
                }}
              />
            </div>
            <input
              className="f-input mt-2"
              value={imageFile ? "" : form.logo_image}
              disabled={!!imageFile}
              onChange={(e) => setForm({ ...form, logo_image: e.target.value })}
              placeholder="…ou coller une URL d'image (https://…)"
            />
          </Field>

          <Field label="Description *">
            <textarea className="f-input min-h-[90px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>

          {form.download_type === "external_link" ? (
            <Field label="Lien de téléchargement *">
              <input className="f-input" value={form.download_url} onChange={(e) => setForm({ ...form, download_url: e.target.value })} placeholder="https://…" />
            </Field>
          ) : (
            <Field label="Fichier APK *">
              <button type="button" onClick={() => apkInputRef.current?.click()} className={`w-full rounded-xl border-2 border-dashed p-4 text-left transition-colors ${apkFile ? "border-violet bg-violet/5" : "border-border hover:border-violet/40"}`}>
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <FileDown className="h-4 w-4 text-violet" />
                  {apkFile ? apkFile.name : hasExistingApk ? `Remplacer « ${application.apk_file_name} »` : "Sélectionner un fichier .apk"}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {apkFile ? `${formatFileSize(apkFile.size)} — prêt à être téléversé` : "Depuis votre téléphone ou votre ordinateur (extension .apk uniquement)"}
                </span>
              </button>
              <input
                ref={apkInputRef}
                type="file"
                accept={APK_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (!isApkFile(f)) {
                      setError("Seuls les fichiers .apk sont acceptés.");
                      e.target.value = "";
                      return;
                    }
                    setError("");
                    setApkFile(f);
                  }
                }}
              />
            </Field>
          )}

          <Field label="Fonctionnalités principales">
            <textarea className="f-input min-h-[70px]" value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} placeholder="Liste des fonctionnalités (optionnel)" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix"><input className="f-input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Gratuit" /></Field>
            <Field label="Lien d'achat (optionnel)"><input className="f-input" value={form.purchase_url} onChange={(e) => setForm({ ...form, purchase_url: e.target.value })} placeholder="https://…" /></Field>
          </div>

          <label className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="h-4 w-4 rounded" />
            <span className="text-sm font-medium">Publier (visible par tous les membres actifs)</span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl gradient-novatrax py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
      <style>{`.f-input{width:100%;border-radius:.75rem;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:.625rem .875rem;font-size:.875rem;outline:none}.f-input:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary)/.15)}.f-input:disabled{opacity:.6}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><div className="mt-1.5">{children}</div></label>;
}