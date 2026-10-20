import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import { Image } from "@/components/ui/image";
import { formatFcfa } from "@/lib/commissions";
import { Link2, TrendingUp, Clock3, Search, ExternalLink, Loader2 } from "lucide-react";

const LINK_BADGES = {
  active: { label: "Actif", cls: "bg-emerald-500/10 text-emerald-600" },
  paused: { label: "En pause", cls: "bg-amber-500/10 text-amber-600" },
  blocked: { label: "Bloqué", cls: "bg-destructive/10 text-destructive" },
};

const PAYMENT_BADGES = {
  awaiting_payment: { label: "En attente de paiement", cls: "bg-amber-500/10 text-amber-600" },
  completed: { label: "Reçu", cls: "bg-emerald-500/10 text-emerald-600" },
  cancelled: { label: "Annulé", cls: "bg-muted text-muted-foreground" },
};

// Surveillance administrative des liens de paiement : statistiques globales
// (liens créés, montants encaissés, commissions 10 %), liste de tous les liens
// et de toutes les transactions effectuées via ces liens. Vue en lecture —
// les paiements sont confirmés uniquement par le prestataire, côté serveur.
export default function PaymentLinksAdmin() {
  const [tab, setTab] = useState("liens");
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoadingStats(true);
    Promise.all([
      api.entities.PaymentLink.count().catch(() => null),
      api.entities.PaymentLink.count({ status: "active" }).catch(() => null),
      api.entities.PaymentLinkPayment.aggregate({
        query: {},
        groupBy: "status",
        sum: ["amount_fcfa", "commission_fcfa"],
      }).catch(() => ({ rows: [] })),
    ])
      .then(([total, active, agg]) => {
        if (!alive) return;
        const byStatus = {};
        for (const row of agg.rows || []) byStatus[row.status] = row;
        setStats({
          total,
          active,
          received: byStatus.completed?.sum_amount_fcfa || 0,
          commissions: byStatus.completed?.sum_commission_fcfa || 0,
          pending: byStatus.awaiting_payment?.sum_amount_fcfa || 0,
        });
      })
      .finally(() => alive && setLoadingStats(false));
    return () => { alive = false; };
  }, []);

  const dash = (v, money = false) => (stats === null ? "…" : v === null ? "—" : money ? v : v);
  const cards = [
    { label: "Liens créés", value: dash(stats?.total), icon: Link2, color: "bg-primary/10 text-primary" },
    { label: "Liens actifs", value: dash(stats?.active), icon: Link2, color: "bg-emerald-500/10 text-emerald-600" },
    { label: "Encaissé via les liens", value: loadingStats ? "…" : formatFcfa(stats?.received || 0), icon: TrendingUp, color: "bg-violet/10 text-violet" },
    { label: "Commissions NOVATRAX (10 %)", value: loadingStats ? "…" : formatFcfa(stats?.commissions || 0), icon: Clock3, color: "bg-amber-500/10 text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${c.color}`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <p className="mt-3 font-heading text-xl font-bold">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-border bg-card p-1.5 shadow-card">
        {[
          { id: "liens", label: "Tous les liens" },
          { id: "paiements", label: "Transactions" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
              tab === t.id ? "gradient-novatrax text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "liens" ? <LinksTab /> : <PaymentsTab />}
    </div>
  );
}

function LinksTab() {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [linkTotals, setLinkTotals] = useState({});
  const [search, setSearch] = useState("");

  const load = useCallback(async (nextCursor) => {
    setLoading(true);
    try {
      const opts = { sort: "-created_date", limit: 50 };
      if (nextCursor) opts.cursor = nextCursor;
      const page = await api.entities.PaymentLink.filter({}, opts);
      const items = page.items || [];
      setLinks((prev) => (nextCursor ? [...prev, ...items] : items));
      setHasMore(!!page.has_more);
      setCursor(page.next_cursor || null);
    } catch (e) {
      if (!nextCursor) setLinks([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(null);
    api.entities.PaymentLinkPayment.aggregate({
      query: { status: "completed" },
      groupBy: "link_id",
      sum: ["amount_fcfa"],
    })
      .then((agg) => {
        const map = {};
        for (const row of agg.rows || []) map[row.link_id] = { count: row.count, total: row.sum_amount_fcfa || 0 };
        setLinkTotals(map);
      })
      .catch(() => setLinkTotals({}));
  }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? links.filter((l) => [l.name, l.creator_name].filter(Boolean).some((v) => v.toLowerCase().includes(q)))
    : links;

  return (
    <div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un lien ou un créateur…"
          className="w-full rounded-xl border border-border pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {loading && links.length === 0 ? (
        <div className="mt-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground shadow-card">
          Aucun lien de paiement créé pour le moment.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card divide-y divide-border">
          {filtered.map((l) => {
            const badge = LINK_BADGES[l.status] || { label: l.status, cls: "bg-muted text-muted-foreground" };
            const totals = linkTotals[l.id];
            const d = l.created_date ? new Date(l.created_date) : null;
            const priceLabel =
              l.price_type === "fixed"
                ? formatFcfa(l.price_fcfa)
                : `Libre · ${formatFcfa(l.min_fcfa)} – ${formatFcfa(l.max_fcfa)}`;
            return (
              <div key={l.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted">
                  {l.profile_image && <Image src={l.profile_image} alt={l.name} className="h-full w-full" fittingType="fill" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{l.name}</p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {l.creator_name || "Créateur inconnu"} • {priceLabel} {d ? `• créé le ${d.toLocaleDateString("fr-FR")}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Paiements reçus : {totals ? `${totals.count} • ${formatFcfa(totals.total)}` : "aucun"}
                  </p>
                </div>
                <a
                  href={`${window.location.origin}/p/${l.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Voir la page
                </a>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => load(cursor)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Charger plus
          </button>
        </div>
      )}
    </div>
  );
}

function PaymentsTab() {
  const [status, setStatus] = useState("all");
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);

  const load = useCallback(async (nextCursor) => {
    setLoading(true);
    try {
      const query = status === "all" ? {} : { status };
      const opts = { sort: "-created_date", limit: 50 };
      if (nextCursor) opts.cursor = nextCursor;
      const page = await api.entities.PaymentLinkPayment.filter(query, opts);
      const items = page.items || [];
      setPayments((prev) => (nextCursor ? [...prev, ...items] : items));
      setHasMore(!!page.has_more);
      setCursor(page.next_cursor || null);
    } catch (e) {
      if (!nextCursor) setPayments([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    setPayments([]);
    load(null);
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-card p-1.5 shadow-card w-fit">
        {[
          { id: "all", label: "Tous" },
          { id: "completed", label: "Reçus" },
          { id: "awaiting_payment", label: "En attente" },
          { id: "cancelled", label: "Annulés" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setStatus(f.id)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors ${
              status === f.id ? "gradient-novatrax text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && payments.length === 0 ? (
        <div className="mt-4 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />)}</div>
      ) : payments.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground shadow-card">
          Aucune transaction sur les liens de paiement pour ce filtre.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-card divide-y divide-border">
          {payments.map((p) => {
            const badge = PAYMENT_BADGES[p.status] || { label: p.status, cls: "bg-muted text-muted-foreground" };
            const d = p.paid_at || p.created_date ? new Date(p.paid_at || p.created_date) : null;
            return (
              <div key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{p.link_name || "Lien supprimé"}</p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.payment_ref} • Bénéficiaire : {p.creator_email} • Payeur : {p.payer_name || "anonyme"} {d ? `• ${d.toLocaleString("fr-FR")}` : ""}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-heading font-bold text-primary">{formatFcfa(p.amount_fcfa)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Commission {formatFcfa(p.commission_fcfa)} • net créateur {formatFcfa(p.net_fcfa)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={() => load(cursor)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Charger plus
          </button>
        </div>
      )}
    </div>
  );
}