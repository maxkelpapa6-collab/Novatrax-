import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { KeyRound, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { formatDateTime } from "./helpers";

// Activation manuelle de l'accès Pro (sans dépôt de 3 000 FCFA) : décision
// exceptionnelle exécutée côté serveur (fonction adminUserModeration, réservée
// aux administrateurs actifs), avec motif obligatoire et inscription au
// journal d'audit. Ne crée aucune commission ni transaction.
export default function AccessControls({ user, onDone }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  if (user.role === "admin" || user.access_activated === true) {
    return (
      <p className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-700">
        🟣 ACCÈS PRO ACTIVÉ{user.access_activated_at ? ` depuis le ${formatDateTime(user.access_activated_at)}` : ""}
      </p>
    );
  }

  const submit = async () => {
    if (!reason.trim()) {
      toast({
        title: "Motif obligatoire",
        description: "Précisez le motif de cette activation exceptionnelle.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      await base44.functions.invoke("adminUserModeration", {
        action: "activate_access",
        user_id: user.id,
        reason: reason.trim(),
      });
      toast({ title: "Accès Pro activé", description: "Le membre a désormais accès aux fonctionnalités réservées." });
      setOpen(false);
      setReason("");
      onDone?.();
    } catch (e) {
      toast({
        title: "Action impossible",
        description: e?.response?.data?.error || e?.message || "Erreur serveur.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-xl border border-violet/40 px-4 py-2.5 text-sm font-bold text-violet hover:bg-violet/5"
      >
        <KeyRound className="h-4 w-4" /> ACTIVER L'ACCÈS PRO (SANS DÉPÔT)
      </button>

      {open && (
        <div className="mt-3 rounded-xl border border-violet/30 bg-violet/5 p-4">
          <p className="text-sm font-semibold text-violet">
            Activer l'accès Pro de ce membre sans exiger le dépôt de 3 000 FCFA ?
          </p>
          <label className="mt-3 block text-xs font-semibold uppercase text-muted-foreground">
            Motif de l'activation exceptionnelle (obligatoire, journalisé)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : geste commercial, partenaire officiel, compensation d'incident…"
            rows={2}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-violet"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={submit}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl gradient-novatrax px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} CONFIRMER L'ACTIVATION
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            >
              Annuler
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Le membre accède immédiatement aux fonctionnalités réservées ; aucune commission ni transaction n'est créée.
          </p>
        </div>
      )}
    </div>
  );
}