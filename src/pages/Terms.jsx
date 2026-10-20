import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Image } from "@/components/ui/image";
import { LOGO_URL } from "@/components/Logo";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm">
              <Image src={LOGO_URL} alt="NOVATRAX" className="h-full w-full" fittingType="fill" />
            </span>
            <span className="font-heading font-extrabold text-xl">NOVATRAX</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">← Retour à l'accueil</Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><ShieldCheck className="h-3.5 w-3.5" /> Légal</span>
        <h1 className="mt-4 font-heading text-3xl sm:text-4xl font-bold">Conditions d'utilisation</h1>
        <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : 15 octobre 2026</p>
        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">1. Objet</h2>
            <p>Les présentes conditions d'utilisation définissent les modalités d'accès et d'utilisation de la plateforme NOVATRAX. L'inscription à la plateforme implique l'acceptation pleine et entière des présentes conditions.</p>
          </section>
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">2. Inscription et compte</h2>
            <p>L'utilisateur s'engage à fournir des informations exactes lors de son inscription (nom, prénom, pays, numéro de téléphone, adresse e-mail). L'adresse e-mail doit être vérifiée via le code de confirmation envoyé par NOVATRAX. L'utilisateur est responsable de la confidentialité de ses identifiants.</p>
          </section>
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">3. Données enregistrées</h2>
            <p>Lors de l'inscription, NOVATRAX enregistre les coordonnées de l'utilisateur (nom, prénom, pays, numéro de téléphone, adresse e-mail, date d'inscription, statut de vérification). Ces données sont traitées conformément à notre politique de confidentialité et peuvent être consultées par les administrateurs autorisés de la plateforme.</p>
          </section>
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">4. Utilisation de la plateforme</h2>
            <p>L'utilisateur s'engage à utiliser la plateforme de manière licite et respectueuse. Toute utilisation frauduleuse, abusive ou contraire aux lois en vigueur est strictement interdite et peut entraîner la suspension du compte.</p>
          </section>
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">5. Suspension</h2>
            <p>NOVATRAX se réserve le droit de suspendre un compte en cas de manquement aux présentes conditions, conformément aux règles de la plateforme.</p>
          </section>
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">6. Responsabilité</h2>
            <p>NOVATRAX met tout en œuvre pour assurer la disponibilité et la sécurité de la plateforme mais ne saurait être tenue responsable des interruptions ou dysfonctionnements indépendants de sa volonté.</p>
          </section>
        </div>
        <div className="mt-10">
          <Link to="/privacy" className="text-sm font-semibold text-primary hover:underline">Voir la politique de confidentialité →</Link>
        </div>
      </article>
    </div>
  );
}