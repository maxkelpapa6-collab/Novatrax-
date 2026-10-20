import { useEffect, useState } from "react";
import { Image } from "@/components/ui/image";

import { Button } from "@/components/ui/button";
import { Loader2, Upload, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatFcfa } from "@/lib/commissions";

const MAX_DESCRIPTION = 500;
// Même règle que le serveur : aucun lien externe dans les annonces.
const LINK_PATTERN = /(https?:\/\/|www\.|wa\.me|chat\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.|bit\.ly|tinyurl\.com|cutt\.ly|is\.gd|goo\.gl)/i;

// Formulaire de publication d'une annonce Marketplace : nom, photo grande
// taille, prix FCFA, téléphone vendeur, catégorie et description limitée.
// Un aperçu fidèle est affiché avant l'envoi ; la vérification finale reste
// côté serveur (liens externes et produits interdits bloqués automatiquement).
export default function ProductForm({ categories, defaultPhone = "", initial = null, submitting = false, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    price_fcfa: initial?.price_fcfa != null ? String(initial.price_fcfa) : "",
    seller_phone: initial?.seller_phone || defaultPhone || "",
    category: initial?.category || (categories[0] || ""),
    description: initial?.description || "",
    image_url: initial?.image_url || "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  useEffect(() => {
    if (categories.length && !categories.includes(form.category)) {
      setForm((f) => ({ ...f, category: categories[0] }));
    }
  }, [categories]);

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
      setForm((f) => ({ ...f, image_url: res.file_url }));
    } catch (err) {
      setUploadError("Téléversement impossible. Réessayez.");
    } finally {
      setUploading(false);
    }
  };

  const priceNumber = Math.round(Number(form.price_fcfa));
  const canSubmit =
    !submitting && !uploading && name.length >= 3 && !!form.image_url &&
    Number.isFinite(priceNumber) && priceNumber >= 100 && form.category &&
    form.seller_phone.trim().length >= 6 && !linkWarning;

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name,
      description,
      price_fcfa: priceNumber,
      seller_phone: form.seller_phone.trim(),
      category: form.category,
      image_url: form.image_url,
    });
  };

  const field = "w-full rounded-xl border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary bg-background";

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Nom du produit *</label>
          <input className={field} value={form.name} onChange={set("name")} maxLength={100} placeholder="Ex. iPhone 12 — 128 Go" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Prix de vente (FCFA) *</label>
            <input className={field} value={form.price_fcfa} onChange={set("price_fcfa")} inputMode="numeric" placeholder="Ex. 10000" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold">Catégorie *</label>
            <select className={field} value={form.category} onChange={set("category")}>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Numéro de téléphone (visible par les acheteurs) *</label>
          <input className={field} value={form.seller_phone} onChange={set("seller_phone")} placeholder="Ex. +228 90 00 00 00" />
          <p className="mt-1 text-xs text-muted-foreground">C'est le seul canal de contact autorisé dans votre annonce.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-semibold">Description (facultatif)</label>
          <textarea
            className={`${field} min-h-[110px] resize-y`}
            value={form.description}
            onChange={set("description")}
            maxLength={MAX_DESCRIPTION}
            placeholder="État, taille, couleur, conditions de livraison…"
          />
          <p className="mt-1 text-right text-xs text-muted-foreground">{description.length}/{MAX_DESCRIPTION}</p>
        </div>

        {linkWarning && (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/5 border border-destructive/30 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Les liens externes (sites, WhatsApp, Telegram, raccourcisseurs) sont strictement interdits : retirez-les avant de publier, sinon votre annonce sera bloquée automatiquement.
          </div>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <Button type="submit" disabled={!canSubmit} className="rounded-xl gradient-novatrax text-white">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {initial ? "Enregistrer et soumettre à validation" : "Publier l'annonce"}
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-xl">Annuler</Button>
        </div>
      </div>

      {/* Aperçu fidèle de l'annonce avant publication */}
      <div>
        <p className="mb-2 text-sm font-semibold">Aperçu de l'annonce</p>
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          <div className="relative flex aspect-[4/3] items-center justify-center bg-muted">
            {form.image_url ? (
              <Image src={form.image_url} alt="Aperçu" className="h-full w-full" fittingType="fill" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                <p className="text-xs">{uploading ? "Téléversement…" : "Photo requise"}</p>
              </div>
            )}
            {form.category && (
              <span className="absolute left-2.5 top-2.5 rounded-full bg-background/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm">
                {form.category}
              </span>
            )}
          </div>
          <div className="space-y-1.5 p-3">
            <p className="line-clamp-2 text-sm font-semibold">{name || "Nom du produit"}</p>
            <p className="font-heading text-lg font-bold text-primary">
              {Number.isFinite(priceNumber) && priceNumber > 0 ? formatFcfa(priceNumber) : "— FCFA"}
            </p>
            <p className="text-xs text-muted-foreground truncate">📞 {form.seller_phone || "Votre numéro"}</p>
          </div>
        </div>
        <label className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-sm font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {form.image_url ? "Changer la photo" : "Choisir la photo du produit"}
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {uploadError && <p className="mt-2 text-xs text-destructive">{uploadError}</p>}
      </div>
    </form>
  );
}