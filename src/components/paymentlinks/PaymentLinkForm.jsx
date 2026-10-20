import { useState } from "react";
import { Image } from "@/components/ui/image";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatFcfa } from "@/lib/commissions";

const MAX_DESCRIPTION = 500;
// Même règle que le serveur : aucun lien externe dans un lien de paiement.
const LINK_PATTERN = /(https?:\/\/|www\.|wa\.me|chat\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.|bit\.ly|tinyurl\.com|cutt\.ly|is\.gd|goo\.gl)/i;

// Formulaire de création / modification d'un lien de paiement : nom, photo de
// profil, description et prix (fixe, ou montant libre avec minimum / maximum).
// Un aperçu fidèle de la page de paiement est affiché avant l'envoi ; la
// vérification finale reste côté serveur.
export default function PaymentLinkForm({ initial = null, submitting = false, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    description: initial?.description || "",
    profile_image: initial?.profile_image || "",
    price_type: initial?.price_type || "fixed",
    price_fcfa: initial?.price_fcfa != null ? String(initial.price_fcfa) : "",
    min_fcfa: initial?.min_fcfa != null ? String(initial.min_fcfa) : "",
    max_fcfa: initial?.max_fcfa != null ? String(initial.max_fcfa) : "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const name = form.name.trim();
  const description = form.description.trim();
  const linkWarning = LINK_PATTERN.test(name) || LINK_PATTERN.test(description);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("La photo doit être une image (JPG, PNG, WEBP…).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("La photo ne doit pas dépasser 5 Mo.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const res = await base44.integrations.Core.UploadPublicFile({ file });
      setForm((f) => ({ ...f, profile_image: res.file_url }));
    } catch (err) {
      setUploadError("Téléversement impossible. Réessayez.");
    } finally {
      setUploading(false);
    }
  };

  const priceNumber = Math.round(Number(form.price_fcfa));
  const minNumber = Math.round(Number(form.min_fcfa));
  const maxNumber = Math.round(Number(form.max_fcfa));
  const priceOk =
    form.price_type === "fixed"
      ? Number.isFinite(priceNumber) && priceNumber >= 100
      : Number.isFinite(minNumber) && minNumber >= 100 && Number.isFinite(maxNumber) && maxNumber >= minNumber;
  const canSubmit =
    !submitting && !uploading && name.length >= 3 && !!description && !!form.profile_image && priceOk && !linkWarning;

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name,
      description,
      profile_image: form.profile_image,
      price_type: form.price_type,
      price_fcfa: form.price_type === "fixed" ? priceNumber : undefined,
      min_fcfa: form.price_type === "variable" ? minNumber : undefined,
      max_fcfa: form.price_type === "variable" ? maxNumber : undefined,
    });
  };

  const field = "w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary bg-background";
  const pricePreview =
    form.price_type === "fixed"
      ? Number.isFinite(priceNumber) && priceNumber >= 100
        ? formatFcfa(priceNumber)
        : "— FCFA"
      : `Libre · ${Number.isFinite(minNumber) && minNumber >= 100 ? formatFcfa(minNumber) : "?"} – ${Number.isFinite(maxNumber) && maxNumber >= 100 ? formatFcfa(maxNumber) : "?"}`;

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Nom du lien *</label>
          <input className={field} value={form.name} onChange={set("name")} maxLength={100} placeholder="Ex. Soutien scolaire — paiement en ligne" />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Type de prix *</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { id: "fixed", label: "Prix fixe", hint: "Un montant unique" },
              { id: "variable", label: "Prix variable", hint: "Montant libre avec min / max" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setForm((f) => ({ ...f, price_type: opt.id }))}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  form.price_type === opt.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted"
                }`}
              >
                <p className="text-sm font-semibold">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {form.price_type === "fixed" ? (
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Montant à payer (FCFA) *</label>
            <input className={field} value={form.price_fcfa} onChange={set("price_fcfa")} inputMode="numeric" placeholder="Ex. 5000" />
            <p className="mt-1 text-xs text-muted-foreground">Minimum 100 FCFA. Commission NOVATRAX : 10 % — vous recevez 90 %.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Montant minimum (FCFA) *</label>
              <input className={field} value={form.min_fcfa} onChange={set("min_fcfa")} inputMode="numeric" placeholder="Ex. 1000" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold">Montant maximum (FCFA) *</label>
              <input className={field} value={form.max_fcfa} onChange={set("max_fcfa")} inputMode="numeric" placeholder="Ex. 100000" />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">Le payeur choisit son montant entre les deux bornes. Commission NOVATRAX : 10 % — vous recevez 90 %.</p>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-semibold">Description *</label>
          <textarea
            className={`${field} min-h-[110px] resize-y`}
            value={form.description}
            onChange={set("description")}
            maxLength={MAX_DESCRIPTION}
            placeholder="Expliquez aux payeurs ce qu'ils paient (service, don, cotisation…)"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{description.length}/{MAX_DESCRIPTION}</p>
        </div>

        {linkWarning && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/5 border border-destructive/30 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Les liens externes (sites, WhatsApp, Telegram, raccourcisseurs) sont strictement interdits : retirez-les, sinon votre lien sera refusé.
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <Button type="submit" disabled={!canSubmit} className="rounded-xl gradient-novatrax text-white">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? "Enregistrer le lien" : "Créer le lien de paiement"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">Annuler</Button>
        </div>
      </div>

      {/* Aperçu fidèle de la page de paiement */}
      <div>
        <p className="mb-2 text-sm font-semibold">Aperçu du lien</p>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
            {form.profile_image ? (
              <Image src={form.profile_image} alt="Aperçu" className="h-full w-full" fittingType="fill" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                <p className="text-xs">{uploading ? "Téléversement…" : "Photo requise"}</p>
              </div>
            )}
          </div>
          <div className="space-y-1.5 p-3">
            <p className="line-clamp-2 text-sm font-semibold">{name || "Nom du lien"}</p>
            <p className="font-heading text-lg font-bold text-primary">{pricePreview}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{description || "Description affichée aux payeurs…"}</p>
          </div>
        </div>
        <label className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {form.profile_image ? "Changer la photo" : "Choisir la photo de profil"}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {uploadError && <p className="mt-2 text-xs text-destructive">{uploadError}</p>}
      </div>
    </form>
  );
}