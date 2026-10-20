import { Link } from "react-router-dom";
import { Lock } from "lucide-react";

// Règle d'accès principale NOVATRAX : sans dépôt initial confirmé de 3 000 FCFA,
// les fonctionnalités protégées (Contacts, Formations, APK Pro, Parrainage,
// lien de parrainage, copie et partage du lien) restent verrouillées.
// Le contrôle est également appliqué côté serveur par chaque API concernée.
export default function FeatureLocked({ title = "Fonctionnalité verrouillée" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-card">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet/10 text-violet">
        <Lock className="h-7 w-7" />
      </span>
      <h2 className="mt-4 font-heading text-lg font-bold uppercase tracking-wide">🔒 {title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Effectuez d'abord votre dépôt initial de 3 000 FCFA pour débloquer cette fonctionnalité.
      </p>
      <Link
        to="/portefeuille?tab=depot"
        className="mt-5 inline-flex items-center gap-2 rounded-xl gradient-novatrax px-5 py-3 text-sm font-semibold text-white shadow-card hover:shadow-card-hover"
      >
        Déposer 3 000 FCFA
      </Link>
    </div>
  );
}