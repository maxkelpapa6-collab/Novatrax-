import { User, AtSign, Mail, Phone, MapPin, CalendarDays, Link2, BadgeCheck } from "lucide-react";
import { getCountry } from "@/lib/countries";
import { formatDateTime } from "./helpers";

function Row({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="break-words text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

// Informations personnelles : uniquement les données réellement enregistrées.
export default function PersonalInfo({ user, sponsor }) {
  const country = getCountry(user.country);
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || null;
  const sponsorLabel = sponsor
    ? [sponsor.referral_code || sponsor.username, "(" + (sponsor.email || sponsor.id) + ")"].join(" ")
    : user.referred_by || "Aucun parrain enregistré";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-heading text-base font-bold">Informations personnelles</h3>
      <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
        {fullName && <Row icon={User} label="Nom / Prénom" value={fullName} />}
        {user.username && <Row icon={AtSign} label="Nom d'utilisateur" value={user.username} />}
        <Row icon={Mail} label="Adresse e-mail" value={user.email || "—"} />
        {user.phone && <Row icon={Phone} label="Numéro de téléphone" value={user.phone} />}
        <Row icon={MapPin} label="Pays" value={country ? `${country.flag} ${country.name}` : user.country || "—"} />
        <Row icon={CalendarDays} label="Date d'inscription" value={formatDateTime(user.created_date)} />
        <Row icon={BadgeCheck} label="E-mail vérifié" value={user.email_verified ? "Oui" : "Non"} />
        <Row
          icon={BadgeCheck}
          label="Statut du compte"
          value={user.account_status === "suspended" ? "Bloqué" : "Actif"}
        />
        {user.referral_code && <Row icon={Link2} label="Code de parrainage personnel" value={user.referral_code} />}
        <Row icon={Link2} label="Parrain (code / identifiant)" value={sponsorLabel} />
        <Row
          icon={BadgeCheck}
          label="Accès Pro"
          value={user.access_activated ? "Activé" + (user.access_activated_at ? " le " + formatDateTime(user.access_activated_at) : "") : "Non activé"}
        />
      </div>
    </div>
  );
}