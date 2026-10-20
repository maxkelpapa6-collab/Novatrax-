import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { X, Save, Loader2, ImagePlus } from "lucide-react";
import { Image } from "@/components/ui/image";

// Formulaire administrateur : création / modification d'une formation avec
// photo de profil téléversée (affichée en grand sur la carte vitrine).
export default function FormationForm({ formation, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: formation?.title || "",
    description: formation?.description || "",
    profile_image: formation?.profile_image || "",
    cover_image: formation?.cover_image || "",
    content: formation?.content || "",
    published: formation?.published ?? false,
  });
  const [profileFile, setProfileFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setError("Le titre et la description sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = { ...form };

      // Photo de profil : téléversement public (affichée à tous les membres)
      if (profileFile) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: profileFile });
        payload.profile_image = file_url;
      }

      if (formation?.id) {
        await base44.entities.Formation.update(formation.id, payload);
      } else {
        await base44.entities.Formation.create(payload);
      }
      onSaved();
    } catch (err) {
      setError(err?.message || "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = profileFile ? URL.createObjectURL(profileFile) : form.profile_image;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-card rounded-t-3xl sm:rounded-3xl shadow-card-hover max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-card flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-heading text-lg font-bold">{formation ? "Modifier la formation" : "Nouvelle formation"}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <Field label="Photo de profil">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-muted border border-border flex items-center justify-center">
                {previewSrc ? (
                  <Image src={previewSrc} fittingType="fill" className="h-full w-full" alt="Aperçu" />
                ) : (
                  <ImagePlus className="h-7 w-7 text-muted-foreground/60" />
                )}
              </div>
              <div className="flex-1">
                <input
                  id="formation-profile-input"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setProfileFile(e.target.files?.[0] || null)}
                />
                <label
                  htmlFor="formation-profile-input"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  <ImagePlus className="h-4 w-4" /> {profileFile ? "Changer la photo" : "Choisir une photo"}
                </label>
                {(profileFile || form.profile_image) && (
                  <button
                    type="button"
                    onClick={() => { setProfileFile(null); setForm({ ...form, profile_image: "" }); }}
                    className="ml-2 text-xs font-medium text-destructive hover:underline"
                  >
                    Retirer
                  </button>
                )}
                <p className="mt-1.5 text-xs text-muted-foreground">Carrée, affichée en grand sur la carte.</p>
              </div>
            </div>
          </Field>
          <Field label="Titre *">
            <input className="f-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex. Initiation au marketing digital" />
          </Field>
          <Field label="Description *">
            <textarea className="f-input min-h-[100px]" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Présentation courte de la formation" />
          </Field>
          <Field label="URL de l'image de couverture">
            <input className="f-input" value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Contenu détaillé (optionnel)">
            <textarea className="f-input min-h-[120px]" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Programme, objectifs, prérequis…" />
          </Field>
          <label className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer">
            <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="h-4 w-4 rounded" />
            <span className="text-sm font-medium">Publier (visible par tous les membres)</span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-border py-3 text-sm font-semibold hover:bg-muted">Annuler</button>
            <button type="submit" disabled={saving} className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl gradient-novatrax py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saving ? "…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
      <style>{`.f-input{width:100%;border-radius:.75rem;border:1px solid hsl(var(--border));background:hsl(var(--background));padding:.625rem .875rem;font-size:.875rem;outline:none}.f-input:focus{border-color:hsl(var(--primary));box-shadow:0 0 0 3px hsl(var(--primary)/.15)}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><div className="mt-1.5">{children}</div></label>;
}