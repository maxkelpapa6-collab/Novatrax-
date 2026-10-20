import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatFcfa } from "@/lib/commissions";
import { toast } from "@/components/ui/use-toast";
import FinanceBadge from "@/components/FinanceBadge";
import { ArrowDownToLine, RefreshCw, ShieldCheck, XCircle, Loader2 } from "lucide-react";

// Tableau administrateur des dépôts : statuts réels LeekPay uniquement.
// Un dépôt LeekPay ne peut jamais être confirmé manuellement — seulement
// vérifié auprès du prestataire via le serveur (action deposit_verify).
export default function DepositsAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [rejecting, setRejecting] = useState(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.entities.Transaction.filter({ type: "deposit" }, { sort: "-created_date", limit: 100 });
      setRows(res.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (action, id, noteArg) => {
    setBusy((b) => ({ ...b, [id]: action }));
    try {
      const res = await base44.functions.invoke("adminFinance", { action, id, note: noteArg || "" });
      const status = res.data?.status;
      toast({
        title: status === "pending" ? "Vérification effectuée" : "Opération enregistrée",
        description: status === "pending"
          ? (res.data?.message || "Le paiement est toujours en attente selon LeekPay.")
          : "Nouveau statut : " + status,
      });
      setRejecting(null);
      setNote("");
      load();
    } catch (err) {
      toast({ title: "Action impossible", description: err?.response?.data?.error || err?.message || "Réessayez.", variant: "destructive" });
    } finally {
      setBusy((b) => ({ ...b, [id]: null }));
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <ArrowDownToLine className="h-5 w-5 text-primary" /> Dépôts
        </h2>
        <button onClick={load} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted" aria-label="Actualiser">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">Aucun dépôt enregistré pour le moment.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((t) => {
            const isLeekpay = t.method === "leekpay";
            const d = t.created_date ? new Date(t.created_date) : null;
            return (
              <li key={t.id} className="p-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{formatFcfa(t.amount_fcfa)} <span className="font-normal text-sm text-muted-foreground">· {t.user_email || t.user_id}</span></p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      Réf. {t.reference || "—"} {isLeekpay && "· LeekPay"} {d ? `· ${d.toLocaleString("fr-FR")}` : ""}
                    </p>
                  </div>
                  <FinanceBadge status={t.status} />
                </div>

                {t.status === "pending" && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {isLeekpay ? (
                      <button
                        onClick={() => run("deposit_verify", t.id)}
                        disabled={busy[t.id]}
                        className="inline-flex items-center gap-1.5 rounded-xl gradient-novatrax px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {busy[t.id] === "deposit_verify" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        Vérifier auprès de LeekPay
                      </button>
                    ) : (
                      <button
                        onClick={() => run("deposit_confirm", t.id)}
                        disabled={busy[t.id]}
                        className="inline-flex items-center gap-1.5 rounded-xl gradient-novatrax px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> Confirmer
                      </button>
                    )}
                    {rejecting === t.id ? (
                      <div className="flex w-full flex-col gap-2 sm:flex-row">
                        <input
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Motif du rejet (obligatoire)"
                          className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none"
                        />
                        <button
                          onClick={() => run("deposit_reject", t.id, note)}
                          disabled={busy[t.id] || !note.trim()}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
                        >
                          Confirmer le rejet
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setRejecting(t.id); setNote(""); }}
                        disabled={busy[t.id]}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Rejeter
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}