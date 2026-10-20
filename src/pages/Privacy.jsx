import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { Image } from "@/components/ui/image";
import { LOGO_URL } from "@/components/Logo";

export default function Privacy() {
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
        <span className="inline-flex items-center gap-2 rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet"><Lock className="h-3.5 w-3.5" /> Légal</span>
        <h1 className="mt-4 font-heading text-3xl sm:text-4xl font-bold">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-muted-foreground">Dernière mise à jour : 15 octobre 2026</p>
        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">1. Données collectées</h2>
            <p>NOVATRAX collecte les données suivantes lors de l'inscription : nom, prénom, pays, numéro de téléphone (format international), adresse e-mail, date et heure d'inscription, et statut de vérification de l'adresse e-mail.</p>
          </section>
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">2. Finalité du traitement</h2>
            <p>Les données sont utilisées pour créer et gérer le compte de l'utilisateur, vérifier son identité, lui permettre d'accéder aux services de la plateforme (formations, applications Pro) et assurer le fonctionnement du service.</p>
          </section>
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">3. Accès aux données</h2>
            <p>Les coordonnées des utilisateurs inscrits peuvent être consultées par les administrateurs autorisés de NOVATRAX, dans le cadre de la gestion de la plateforme. Les exports de contacts (CSV, VCF) sont réservés aux administrateurs et font l'objet d'une journalisation. Un utilisateur normal ne peut jamais accéder aux données privées des autres membres.</p>
          </section>
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">4. Sécurité</h2>
            <p>Les mots de passe sont chiffrés et ne sont jamais stockés en clair. Les accès sont protégés par des règles de sécurité au niveau de la base de données. Les clés secrètes du backend ne sont jamais exposées dans le code frontend.</p>
          </section>
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">5. Communications commerciales</h2>
            <p>Toute communication commerciale est effectuée dans le respect des règles applicables à la protection des données et aux communications électroniques. L'utilisateur peut exercer ses droits à tout moment.</p>
          </section>
          <section>
            <h2 className="text-foreground font-heading text-lg font-semibold">6. Vos droits</h2>
            <p>Conformément aux lois en vigueur, vous disposez d'un droit d'accès, de rectification et de suppression de vos données. Pour exercer ces droits, contactez NOVATRAX.</p>
          </section>
        </div>
        <div className="mt-10">
          <Link to="/terms" className="text-sm font-semibold text-primary hover:underline">Voir les conditions d'utilisation →</Link>
        </div>
      </article>
    </div>
  );
}