import { useState } from "react";
import { Copy, Check, Share2, Gift } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Copie rapide du lien de parrainage, accessible directement depuis la page
// Réseau : un seul appui et le lien complet est dans le presse-papiers.
export default function ReferralQuickCopy({ code }) {
  const [copied, setCopied] = useState(false);
  const link = code ? `${window.location.origin}/register?ref=${code}` : "";

  const copy = async () => {
    if (!code) return;
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
    if (!code) return;
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
    <div className="rounded-2xl border border-violet/30 bg-accent/50 p-5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet/15 text-violet">
          <Gift className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-heading text-base font-bold">Votre lien de parrainage</h2>
          <p className="text-xs text-muted-foreground">
            Un appui sur le bouton : le lien est copié, prêt à être envoyé.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          readOnly
          value={link || "Génération du code…"}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-medium outline-none"
        />
        <button
          onClick={copy}
          disabled={!code}
          className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-violet px-4 py-2.5 text-sm font-semibold text-violet-foreground hover:bg-violet/90 disabled:opacity-50"
        >
          {copied ? <><Check className="h-4 w-4" /> Copié</> : <><Copy className="h-4 w-4" /> Copie rapide</>}
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
  );
}