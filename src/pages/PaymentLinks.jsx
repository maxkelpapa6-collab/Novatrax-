import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useMemberHome } from "@/hooks/useMemberHome";
import { formatFcfa } from "@/lib/commissions";
import FeatureLocked from "@/components/FeatureLocked";
import PaymentLinkForm from "@/components/paymentlinks/PaymentLinkForm";
import PaymentLinkCard from "@/components/paymentlinks/PaymentLinkCard";
import { Link2, Plus, Wallet, Clock3, BadgeCheck, Loader2, TrendingUp } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const PAYMENT_BADGES = {
  awaiting_payment: { label: "En attente de paiement", cls: "bg-amber-500/10 text-amber-600" },
  completed: { label: "Reçu", cls: "bg-emerald-500/10 text-emerald-600" },
  cancelled: { label: "Annulé", cls: "bg-muted text-muted-foreground" },
};

// Espace « Liens de paiement » : le membre crée des liens partageables (nom,
// photo, description, prix fixe ou variable) pour encaisser des paiements en
// ligne depuis n'importe quel pays. Commission NOVATRAX 10 %, créateur crédité
// de 90 % dans son portefeuille à chaque paiement confirmé.
export default function PaymentLinks() {
  const { user } = useAuth();
  const { data: homeData } = useMemberHome();
  const balance = homeData?.stats?.balance ?? 0;
  const [tab, setTab] = useState("liens");
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | link
  const [submitting, setSubmitting] = useState(false);
  const [busy, setBusy] = useState(false);

  const canCreate = user?.role === "admin" || user?.access_activated === true;

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const page = await base44.entities.PaymentLink.filter(
        { creator_id: user.id },
        { sort: "-created_date", limit: 50 }
      );
      setLinks(page.items || []);
    } catch (e) {
      setLinks([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const submitLink = async (data) => {
    setSubmitting(true);
    try {
      await base44.functions.invoke("paymentLink", {
        action: editing === "new" ? "create" : "update",
        link_id: editing !== "new" ? editing.id : undefined,
        ...data,
      });
      toast({
        title: editing === "new" ? "Lien de paiement créé" : "Lien mis à jour",
        description: "Partagez-le : chaque paiement confirmé crédite 90 % du montant dans votre portefeuille.",
      });
      setEditing(null);
      load();
    } catch (e) {
      toast({
        title: "Enregistrement impossible",
        description: e?.response?.data?.error || e?.message || "Réessayez.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLink = async (link) => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke("paymentLink", { action: "toggle", link_id: link.id });
      toast({ title: res.data?.status === "active" ? "Lien réactivé" : "Lien mis en pause" });
      load();
    } catch (e) {
      toast({ title: "Action impossible", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const removeLink = async (link) => {
    if (!window.confirm(`Supprimer le lien « ${link.name} » ? Les paiements déjà reçus restent conservés.`)) return;
    setBusy(true);
    try {
      await base44.functions.invoke("paymentLink", { action: "delete", link_id: link.id });
      toast({ title: "Lien supprimé" });
      load();
    } catch (e) {
      toast({ title: "Suppression impossible", description: e?.response?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (link) => {
    const url = `${window.location.origin}/p/${link.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Lien copié", description: "Partagez-le par e-mail, WhatsApp ou sur vos réseaux." });
    } catch (e) {
      window.prompt("Copiez votre lien de paiement :", url);
    }
  };

  if (!canCreate) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <h1 className="mb-4 font-heading text-3xl font-bold">Liens de paiement</h1>
        <FeatureLocked title="Créer des liens de paiement" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <span className="inline-flex items-center gap-2 rounded-full bg-violet/10 px-3 py-1 text-xs font-semibold text-violet">
        <Link2 className="h-3.5 w-3.5" /> Liens de paiement
      </span>
      <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold">Encaissez des paiements en ligne</h1>
      <p className="mt-2 text-muted-foreground">
        Créez un lien de paiement et partagez-le : vos contacts paient depuis n'importe quel pays via Mobile Money.
        Commission NOVATRAX 10 % — vous recevez 90 % de chaque paiement directement dans votre portefeuille.
      </p>

      <div className="mt-6 flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-border bg-card p-1.5 shadow-card">
        {[
          { id: "liens", label: "Mes liens", icon: Link2 },
          { id: "paiements", label: "Paiements reçus", icon: BadgeCheck },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${
                tab === t.id ? "gradient-novatrax text-white shadow-sm" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "liens" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-bold">Mes liens de paiement</h2>
            <button
              onClick={() => setEditing("new")}
              className="inline-flex items-center gap-2 rounded-xl gradient-novatrax px-4 py-2.5 text-sm font-semibold text-white shadow-card"
            >
              <Plus className="h-4 w-4" /> Créer un lien
            </button>
          </div>

          {editing && (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <h3 className="mb-4 font-heading font-bold">
                {editing === "new" ? "Nouveau lien de paiement" : "Modifier le lien"}
              </h3>
              <PaymentLinkForm
                initial={editing === "new" ? null : editing}
                submitting={submitting}
                onSubmit={submitLink}
                onCancel={() => setEditing(null)}
              />
            </div>
          )}

          {loading ? (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-[3/4] rounded-2xl bg-muted/50 animate-pulse" />)}
            </div>
          ) : links.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card">
              <Link2 className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-semibold">Vous n'avez encore créé aucun lien.</p>
              <p className="mt-1 text-sm text-muted-foreground">Créez votre premier lien : nom, photo, description et prix (fixe ou libre).</p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {links.map((l) => (
                <PaymentLinkCard
                  key={l.id}
                  link={l}
                  busy={busy}
                  onCopy={() => copyLink(l)}
                  onEdit={() => setEditing(l)}
                  onToggle={() => toggleLink(l)}
                  onDelete={() => removeLink(l)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "paiements" && <PaymentsTab user={user} balance={balance} />}
    </div>
  );
}

function PaymentsTab({ user, balance }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totals, setTotals] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      base44.entities.PaymentLinkPayment.filter({ creator_id: user.id }, { sort: "-created_date", limit: 50 }),
      base44.entities.PaymentLinkPayment.aggregate({
        query: { creator_id: user.id },
        groupBy: "status",
        sum: ["net_fcfa", "amount_fcfa"],
      }),
    ])
      .then(([page, agg]) => {
        if (!alive) return;
        setPayments(page.items || []);
        const byStatus = {};
        for (const row of agg.rows || []) byStatus[row.status] = row;
        setTotals({
          pending: byStatus.awaiting_payment?.sum_net_fcfa || 0,
          received: byStatus.completed?.sum_net_fcfa || 0,
          total: Object.values(byStatus).reduce((acc, r) => acc + (r.sum_amount_fcfa || 0), 0),
        });
      })
      .catch(() => alive && setPayments([]))
      .finally(() => alive && setLoading(false));
    // Temps réel : les paiements se mettent à jour sans rechargement.
    const unsubscribe = base44.entities.PaymentLinkPayment.subscribe(() => {
      if (alive) setLoading(true);
    });
    return () => { alive = false; unsubscribe(); };
  }, [user?.id]);

  const cards = [
    { label: "Solde disponible (portefeuille)", value: formatFcfa(balance), icon: Wallet, color: "bg-primary/10 text-primary" },
    { label: "Paiements reçus (net 90 %)", value: totals ? formatFcfa(totals.received) : "…", icon: BadgeCheck, color: "bg-emerald-500/10 text-emerald-600" },
    { label: "En attente de paiement", value: totals ? formatFcfa(totals.pending) : "…", icon: Clock3, color: "bg-amber-500/10 text-amber-600" },
    { label: "Total encaissé via mes liens", value: totals ? formatFcfa(totals.total) : "…", icon: TrendingUp, color: "bg-violet/10 text-violet" },
  ];

  return (
    <div className="mt-6 space-y-6">
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

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />)}</div>
      ) : payments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-card">
          <Link2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">Aucun paiement pour le moment.</p>
          <p className="mt-1 text-sm text-muted-foreground">Partagez vos liens : chaque paiement confirmé apparaîtra ici et créditera votre portefeuille.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card divide-y divide-border">
          {payments.map((p) => {
            const badge = PAYMENT_BADGES[p.status] || { label: p.status, cls: "bg-muted text-muted-foreground" };
            const d = p.created_date ? new Date(p.created_date) : null;
            return (
              <div key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold truncate">{p.link_name || "Lien de paiement"}</p>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.payment_ref} • Payeur : {p.payer_name || "anonyme"} {d ? `• ${d.toLocaleString("fr-FR")}` : ""}
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-heading font-bold text-primary">{formatFcfa(p.net_fcfa)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Payé {formatFcfa(p.amount_fcfa)} − commission {formatFcfa(p.commission_fcfa)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}