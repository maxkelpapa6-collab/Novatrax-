import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/client";
import { COUNTRIES, getCountry } from "@/lib/countries";
import { User as UserIcon, Mail, Phone, Globe, Save, CheckCircle2 } from "lucide-react";

export default function Profile() {
  const { user, checkUserAuth } = useAuth();
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    country: "",
    phone: "",
    share_contacts: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        country: user.country || "",
        phone: user.phone || "",
        share_contacts: user.share_contacts === true,
      });
    }
  }, [user]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const selected = getCountry(form.country);
      const phone = form.phone && selected && !form.phone.startsWith("+")
        ? selected.dialCode + form.phone.replace(/\s/g, "")
        : form.phone;
      await api.auth.updateMe({
        first_name: form.first_name,
        last_name: form.last_name,
        country: form.country,
        phone,
        share_contacts: form.share_contacts === true,
      });
      if (checkUserAuth) await checkUserAuth();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err?.message || "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const country = getCountry(form.country);

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-novatrax text-white">
          <UserIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-bold">Mon profil</h1>
          <p className="text-sm text-muted-foreground">Consultez et modifiez vos informations personnelles.</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="grid gap-4 sm:grid-cols-2 mb-6">
          <ReadOnly label="Adresse e-mail" value={user?.email || "—"} icon={Mail} />
          <ReadOnly label="Rôle" value={user?.role === "admin" ? "Administrateur" : "Membre"} icon={UserIcon} />
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom">
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="input-novatrax"
                placeholder="Votre prénom"
              />
            </Field>
            <Field label="Nom">
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="input-novatrax"
                placeholder="Votre nom"
              />
            </Field>
          </div>

          <Field label="Pays">
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="input-novatrax pl-9 appearance-none"
              >
                <option value="">Sélectionnez votre pays</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.dialCode})</option>
                ))}
              </select>
            </div>
          </Field>

          <Field label="Numéro de téléphone">
            <div className="flex gap-2">
              <div className="relative w-32 shrink-0">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  readOnly
                  value={country ? country.dialCode : "+…"}
                  className="input-novatrax pl-9 bg-muted/60"
                />
              </div>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="input-novatrax flex-1"
                placeholder="Numéro sans l'indicatif"
              />
            </div>
          </Field>

          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.share_contacts}
                onChange={(e) => setForm({ ...form, share_contacts: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-input accent-violet"
              />
              <span className="text-sm">
                <span className="font-semibold">Annuaire des membres</span>
                <span className="mt-0.5 block text-muted-foreground">
                  J'accepte que mon nom et mon numéro de téléphone soient visibles et partageables
                  avec les membres autorisés de NOVATRAX. Vous pouvez retirer ce consentement à tout
                  moment — vous disparaîtrez alors des nouveaux fichiers de contacts générés.
                </span>
              </span>
            </label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && (
            <p className="text-sm text-emerald-600 inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> Modifications enregistrées.
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl gradient-novatrax px-6 py-3 text-sm font-semibold text-white shadow-card hover:shadow-card-hover disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {saving ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        </form>
      </div>

      <style>{`
        .input-novatrax {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--background));
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .input-novatrax:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--primary) / .15); }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function ReadOnly({ label, value, icon: Icon }) {
  return (
    <div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}