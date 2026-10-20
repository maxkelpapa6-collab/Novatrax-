import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { formatFcfa } from "@/lib/commissions";
import { toast } from "@/components/ui/use-toast";
import FinanceBadge from "@/components/FinanceBadge";
import {
  AlertTriangle, Ban, ChevronDown, ChevronUp, Loader2, RefreshCw, Receipt, ThumbsDown, Unlock,
} from "lucide-react";

const STATUS_LABELS = {
  pending_review: { label: "À examiner", tone: "bg-amber-500/10 text-amber-600" },
  anomaly_confirmed: { label: "Anomalie confirmée", tone: "bg-destructive/10 text-destructive" },
  commissions_released: { label: "Premier paiement validé", tone: "bg-emerald-500/10 text-emerald-600" },
  claim_refused: { label: "Réclamation refusée", tone: "bg-muted text-muted-foreground" },
};

const ACTIONS = [
  { id: "release_commissions", label: "Valider le premier paiement", icon: Unlock, className: "gradient-novatrax text-white" },
  { id: "confirm_anomaly", label: "Confirmer l'anomalie", icon: Ban, className: "border border-destructive/30 text-destructive hover:bg-destructive/5" },
  { id: "refuse_claim", label: "Refuser la réclamation", icon: ThumbsDown, className: "border border-border text-muted-foreground hover:bg-muted" },
  { id: "refund_second", label: "Rembourser / traiter le 2ᵉ paiement", icon: Receipt, className: "border border-primary/30 text-primary hover:bg-primary/5" },
];

const parseJson = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (e) {
    return fallback;
  }
};

// Dossiers de double paiement des frais d'accès (3 000 FCFA) :
// examen complet du membre, des deux paiements, de l'arbre de parrainage,
// et de l'historique — avec les 4 décisions possibles.
export default function DepositReviewsAdmin() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState({});
  const [note, setNote] = useState({});
  const [expanded, setExpanded] = useState({});
  const [details, setDetails] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("adminDepositReview", { action: "list" });
      setRows(res.data?.reviews || []);
    } catch (e) {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleDetails = async (id) => {
    if (expanded[id]) {
      setExpanded((e) => ({ ...e, [id]: false }));
      return;
    }
    setExpanded((e) => ({ ...e, [id]: true }));
    if (!details[id]) {
      try {
        const res = await base44.functions.invoke("adminDepositReview", { action: "details", id });
        setDetails((d) => ({ ...d, [id]: res.data || null }));
      } catch (e) {
        setDetails((d) => ({ ...d, [id]: { transactions: [] } }));
      }
    }
  };

  const run = async (actionId, id) => {
    if (actionId === "refund_second" && !(note[id] || "").trim()) {
      toast({
        title: "Note requise",
        description: "Indiquez la référence ou les modalités du remboursement du deuxième paiement.",
        variant: "destructive",
      });
      return;
    }
    setBusy((b) => ({ ...b, [id]: actionId }));
    try {
      const res = await base44.functions.invoke("adminDepositReview", {
        action: actionId,
        id,
        note: (note[id] || "").trim(),
      });
      toast({
        title: "Décision enregistrée",
        description: "Nouveau statut : " + (STATUS_LABELS[res.data?.status]?.label || res.data?.status || "enregistré"),
      });
      setNote((n) => ({ ...n, [id]: "" }));
      load();
    } catch (err) {
      toast({ title: "Action impossible", description: err?.response?.data?.error || err?.message || "Réessayez.", variant: "destructive" });
    } finally {
      setBusy((b) => ({ ...b, [id]: null }));
    }
  };

  const dateFr = (d) => (d ? new Date(d).toLocaleString("fr-FR") : "—");

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold">
          <AlertTriangle className="h-5 w-5 text-amber-500" /> Doubles paiements des frais d'accès
        </h2>
        <button onClick={load} className="rounded-xl border border-border p-2 text-muted-foreground hover:bg-muted" aria-label="Actualiser">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2 p-5">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">
          Aucune anomalie de dépôt détectée. Les doubles dépôts initiaux apparaîtront ici pour examen.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => {
            const st = STATUS_LABELS[r.status] || { label: r.status, tone: "bg-muted text-muted-foreground" };
            const chain = parseJson(r.sponsor_chain, []);
            const txs = details[r.id]?.transactions || null;
            return (
              <li key={r.id} className="p-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {r.user_name || r.user_email || r.user_id}{" "}
                      <span className="font-normal text-sm text-muted-foreground">· {r.user_email}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Dossier ouvert le {dateFr(r.created_date)} · {r.blocked_levels}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${st.tone}`}>
                    {st.label}
                  </span>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Premier dépôt</p>
                    <p className="mt-1 text-sm font-semibold">{formatFcfa(r.first_amount_fcfa)}</p>
                    <p className="text-xs text-muted-foreground">Réf. {r.first_reference || "—"}</p>
                    <p className="text-xs text-muted-foreground">Créé le {dateFr(r.first_date)}</p>
                    <p className="text-xs text-muted-foreground">Confirmé le {dateFr(r.first_confirmed_at)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deuxième dépôt</p>
                    <p className="mt-1 text-sm font-semibold">{formatFcfa(r.second_amount_fcfa)}</p>
                    <p className="text-xs text-muted-foreground">Réf. {r.second_reference || "—"}</p>
                    <p className="text-xs text-muted-foreground">Créé le {dateFr(r.second_date)}</p>
                    <p className="text-xs text-muted-foreground">Confirmé le {dateFr(r.second_confirmed_at)}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Arbre de parrainage</p>
                    {chain.length === 0 ? (
                      <p className="mt-1 text-xs text-muted-foreground">Aucun parrain enregistré.</p>
                    ) : (
                      <ul className="mt-1 space-y-0.5">
                        {chain.map((s) => (
                          <li key={s.level + s.id} className="text-xs text-muted-foreground">
                            Niveau {s.level} : {s.email || s.id}{s.username ? ` (@${s.username})` : ""}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {(r.refund_note || r.decided_by) && (
                  <p className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    {r.decided_by && <>Décision : {STATUS_LABELS[r.status]?.label || r.status} par {r.decided_by} le {dateFr(r.decided_at)}. </>}
                    {r.refund_note && <>2ᵉ paiement traité par {r.refunded_by} le {dateFr(r.refunded_at)} : {r.refund_note}.</>}
                    {r.admin_notes && <> Notes : {r.admin_notes}.</>}
                  </p>
                )}

                {r.status === "pending_review" && (
                  <div className="mt-3 space-y-2">
                    <input
                      value={note[r.id] || ""}
                      onChange={(e) => setNote((n) => ({ ...n, [r.id]: e.target.value }))}
                      placeholder="Note d'examen / référence du remboursement (requis pour rembourser)"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      {ACTIONS.map((a) => {
                        const Icon = a.icon;
                        return (
                          <button
                            key={a.id}
                            onClick={() => run(a.id, r.id)}
                            disabled={busy[r.id]}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold disabled:opacity-50 ${a.className}`}
                          >
                            {busy[r.id] === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                            {a.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => toggleDetails(r.id)}
                  className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet hover:underline"
                >
                  {expanded[r.id] ? <><ChevronUp className="h-3.5 w-3.5" /> Masquer l'historique</> : <><ChevronDown className="h-3.5 w-3.5" /> Historique complet des transactions</>}
                </button>
                {expanded[r.id] && (
                  <div className="mt-2 rounded-xl border border-border bg-background p-3">
                    {txs === null ? (
                      <p className="text-xs text-muted-foreground">Chargement…</p>
                    ) : txs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Aucune transaction.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {txs.map((t) => (
                          <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold">
                                {t.type === "deposit" ? "Dépôt" : t.type === "withdrawal" ? "Retrait" : "Ajustement"} · {formatFcfa(t.amount_fcfa)}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {dateFr(t.created_date)} · Réf. {t.reference || "—"}{t.description ? ` · ${t.description}` : ""}
                              </p>
                            </div>
                            <FinanceBadge status={t.status} />
                          </li>
                        ))}
                      </ul>
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