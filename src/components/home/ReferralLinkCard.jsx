import { useState } from "react";
import { Link } from "react-router-dom";
import { Gift, Copy, Check, Share2, Users, Lock } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Carte « Votre lien de parrainage » : code personnel unique et permanent.
// Sans dépôt initial confirmé (3 000 FCFA), le lien n'est pas transmis par le
// serveur : la carte affiche le verrou et les boutons copier/partager sont absents.
export default function ReferralLinkCard({ code, locked }) {
  const [copied, setCopied] = useState(false);
  const link = code ? `${window.location.origin}/register?ref=${code}` : "";

  const copy = async () => {
    if (locked || !code) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({ title: "Lien copié", description: "Votre lien de parrainage a été copié dans le presse-papiers." });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copie impossible",
        description: "Sélectionnez le lien dans le champ et copiez-le manuellement.",
        variant: "destructive",
      });
    }
  };

  // Partage natif sur mobile, copie en solution de remplacement
  const share = async () => {
    if (locked || !code) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "NOVATRAX", text: "Rejoins-moi sur NOVATRAX :", url: link });
        return;
      } catch {
        // partage annulé : pas de copie forcée
        return;
      }
    }
    copy();
  };

  return (
    <div id="parrainage" className="scroll-mt-20 rounded-2xl border border-violet/30 bg-accent/50 p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet/15 text-violet">
          <Gift className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-heading text-base font-bold">Votre lien de parrainage</h2>
          <p className="text-xs text-muted-foreground">
            Partagez-le : vos filleuls seront automatiquement rattachés à votre réseau.
          </p>
        </div>
      </div>

      {locked ? (
        <div className="mt-4 rounded-xl border border-violet/30 bg-background/70 p-5 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet/10 text-violet">
            <Lock className="h-6 w-6" />
          </span>
          <p className="mt-3 font-heading text-sm font-bold uppercase tracking-wide">🔒 Fonctionnalité verrouillée</p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
            Effectuez d'abord votre dépôt initial de 3 000 FCFA pour débloquer votre lien de parrainage.
          </p>
          <Link
            to="/portefeuille?tab=depot"
            className="mt-4 inline-flex items-center gap-2 rounded-xl gradient-novatrax px-5 py-2.5 text-sm font-semibold text-white shadow-card"
          >
            Déposer 3 000 FCFA
          </Link>
        </div>
      ) : (
        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <input
            readOnly
            value={link || "Génération du code…"}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={copy}
              disabled={!code}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-sm font-semibold text-violet-foreground hover:bg-violet/90 disabled:opacity-50"
            >
              {copied ? <><Check className="h-4 w-4" /> Copié</> : <><Copy className="h-4 w-4" /> Copier mon lien de parrainage</>}
            </button>
            <button
              onClick={share}
              disabled={!code}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-violet/40 bg-background px-4 py-2.5 text-sm font-semibold text-violet hover:bg-violet/5 disabled:opacity-50"
            >
              <Share2 className="h-4 w-4" /> Partager
            </button>
          </div>
        </div>
      )}

      <Link to="/reseau" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet hover:underline">
        <Users className="h-4 w-4" /> Voir mon réseau
      </Link>
    </div>
  );
}