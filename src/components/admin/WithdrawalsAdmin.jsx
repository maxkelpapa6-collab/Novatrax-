import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { getCountry, WITHDRAWAL_METHOD_LABELS } from "@/lib/countries";
import { formatFcfa } from "@/lib/commissions";
import { toast } from "@/components/ui/use-toast";
import FinanceBadge from "@/components/FinanceBadge";
import { ArrowUpFromLine, RefreshCw, Loader2, XCircle, CheckCircle2, Banknote } from "lucide-react";

// Tableau administrateur des demandes de retrait : examen, validation,
// refus motivé et marquage « payé » uniquement après paiement effectif.
// Le montant demandé reste réservé dans le solde tant que la demande est
// en attente / en traitement / approuvée (calcul côté serveur).
export default function WithdrawalsAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [noteFor, setNoteFor] = useState(null); // { id, kind: "reject" | "paid" }
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.entities.Withdrawal.filter({}, { sort: "-created_date", limit: 100 });
      setRows(res.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (action, id, noteArg) => {
    setBusy((b) => ({ ...b, [id]: action }));
    try {
      const res = await api.functions.invoke("adminFinance", { action, id, note: noteArg || "" });
      toast({ title: "Décision enregistrée", description: "Nouveau statut : " + (res.data?.status || "ok") });
      setNoteFor(null);
      setNote("");
      load();
    } catch (err) {
      toast({ title: "Action impossible", description: err?.response?.data?.error || err?.message || "Réessayez.", variant: "destructive" });
    } finally {
      setBusy((b) => ({ ...b, [id]: null }));
    }
  };

  const noteBox = (w, kind) => (
    <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={kind === "reject" ? "Motif du refus (obligatoire)" : "Référence du paiement exécuté (obligatoire)"}
        className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none"
      />
      <button
        onClick={() => run(kind === "reject" ? "withdrawal_reject" : "withdrawal_mark_paid", w.id, note)}
        disabled={busy[w.id] || !note.trim()}
        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${kind === "reject" ? "bg-destructive" : "gradient-novatrax"}`}
      >
        {busy[w.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {kind === "reject" ? "Confirmer le refus" : "Confirmer le paiement"}
      </button>
    </div>
  );

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <ArrowUpFromLine className="h-5 w-5 text-rose-500" /> Demandes de retrait
        </h2>
        <button onClick={load} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted" aria-label="Actualiser">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">Aucune demande de retrait pour le moment.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((w) => {
            const c = getCountry(w.country);
            const d = w.created_date ? new Date(w.created_date) : null;
            const actionable = ["pending", "processing", "approved"].includes(w.status);
            return (
              <li key={w.id} className="p-4 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{formatFcfa(w.amount_fcfa)} <span className="font-normal text-sm text-muted-foreground">· {w.user_name || w.user_email}</span></p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c ? `${c.flag} ${c.name}` : "Pays non renseigné"} · {WITHDRAWAL_METHOD_LABELS[w.payment_method] || w.payment_method} · {w.reception_number || "—"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      Réf. {w.transaction_ref || "—"} {d ? `· ${d.toLocaleString("fr-FR")}` : ""}
                      {w.rejection_reason ? ` · Motif : ${w.rejection_reason}` : ""}
                    </p>
                  </div>
                  <FinanceBadge status={w.status} />
                </div>

                {actionable && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {w.status === "pending" && (
                      <button
                        onClick={() => run("withdrawal_examine", w.id)}
                        disabled={busy[w.id]}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                      >
                        {busy[w.id] === "withdrawal_examine" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Mettre en traitement
                      </button>
                    )}
                    {(w.status === "pending" || w.status === "processing") && (
                      <button
                        onClick={() => run("withdrawal_approve", w.id)}
                        disabled={busy[w.id]}
                        className="inline-flex items-center gap-1.5 rounded-xl gradient-novatrax px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Valider
                      </button>
                    )}
                    {w.status !== "approved" && (
                      <button
                        onClick={() => { setNoteFor(w.id === noteFor?.id ? null : { id: w.id, kind: "reject" }); setNote(""); }}
                        disabled={busy[w.id]}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-destructive/30 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Refuser
                      </button>
                    )}
                    {w.status === "approved" && (
                      <button
                        onClick={() => { setNoteFor(w.id === noteFor?.id ? null : { id: w.id, kind: "paid" }); setNote(""); }}
                        disabled={busy[w.id]}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Banknote className="h-3.5 w-3.5" /> Marquer comme payé
                      </button>
                    )}
                  </div>
                )}
                {noteFor?.id === w.id && noteBox(w, noteFor.kind)}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}