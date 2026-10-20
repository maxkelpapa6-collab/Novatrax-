import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Ban, Unlock, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const BLOCK_REASONS = [
  "Fraude suspectée",
  "Activité anormale",
  "Double dépôt",
  "Tentative de manipulation du système",
  "Violation des conditions d'utilisation",
  "Autre",
];

// Blocage / déblocage d'un compte : la décision est exécutée côté serveur
// (fonction adminUserModeration, réservée aux administrateurs actifs), avec
// motif obligatoire et inscription au journal d'audit. Aucune donnée du
// compte n'est supprimée.
export default function BlockControls({ user, onDone }) {
  const [panel, setPanel] = useState(null);
  const [reason, setReason] = useState("");
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  if (user.role === "admin") {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        Compte administrateur : le blocage depuis cette fiche est désactivé.
      </p>
    );
  }

  const call = async (payload, okTitle) => {
    setBusy(true);
    try {
      await base44.functions.invoke("adminUserModeration", payload);
      toast({ title: okTitle });
      setPanel(null);
      setReason("");
      setCustom("");
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

  const submitBlock = () => {
    const motif = reason === "Autre" ? custom.trim() : reason;
    if (!motif) {
      toast({
        title: "Motif obligatoire",
        description: "Sélectionnez ou précisez le motif du blocage.",
        variant: "destructive",
      });
      return;
    }
    call({ action: "block", user_id: user.id, reason: motif }, "Compte bloqué");
  };

  const suspended = user.account_status === "suspended";

  return (
    <div className="mt-4">
      {suspended ? (
        <button
          onClick={() => setPanel(panel === "unblock" ? null : "unblock")}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 px-4 py-2.5 text-sm font-bold text-emerald-600 hover:bg-emerald-500/5"
        >
          <Unlock className="h-4 w-4" /> DÉBLOQUER LE COMPTE
        </button>
      ) : (
        <button
          onClick={() => setPanel(panel === "block" ? null : "block")}
          className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2.5 text-sm font-bold text-destructive hover:bg-destructive/5"
        >
          <Ban className="h-4 w-4" /> BLOQUER LE COMPTE
        </button>
      )}

      {panel === "block" && (
        <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-semibold text-destructive">Êtes-vous sûr de vouloir bloquer ce compte ?</p>
          <label className="mt-3 block text-xs font-semibold uppercase text-muted-foreground">
            Motif du blocage (obligatoire)
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="">— Sélectionner un motif —</option>
            {BLOCK_REASONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          {reason === "Autre" && (
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Précisez le motif du blocage…"
              rows={2}
              className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={submitBlock}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />} CONFIRMER LE BLOCAGE
            </button>
            <button
              onClick={() => setPanel(null)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            >
              Annuler
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Le compte et toutes ses données sont conservés : seules les opérations (connexion, retraits, commissions,
            accès réservés) sont suspendues.
          </p>
        </div>
      )}

      {panel === "unblock" && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <p className="text-sm font-semibold">Confirmer le déblocage de ce compte ?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => call({ action: "unblock", user_id: user.id }, "Compte débloqué")}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />} CONFIRMER LE DÉBLOCAGE
            </button>
            <button
              onClick={() => setPanel(null)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}