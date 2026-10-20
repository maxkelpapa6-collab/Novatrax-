import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/client";
import { getCountry } from "@/lib/countries";
import {
  LayoutDashboard, Users, GraduationCap, Smartphone, ScrollText, Ban, CheckCircle2,
  Search, ShieldCheck, ArrowRight, FileSpreadsheet, Wallet as WalletIcon, Mail, Store, Link2,
} from "lucide-react";
import MarketplaceAdmin from "@/components/admin/MarketplaceAdmin";
import PaymentLinksAdmin from "@/components/admin/PaymentLinksAdmin";
import DepositsAdmin from "@/components/admin/DepositsAdmin";
import MessagesAdmin from "@/components/admin/MessagesAdmin";
import WithdrawalsAdmin from "@/components/admin/WithdrawalsAdmin";
import DepositReviewsAdmin from "@/components/admin/DepositReviewsAdmin";
import UserSearchSection from "@/components/admin/UserSearchSection";

const TABS = [
  { id: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
  { id: "users", label: "Utilisateurs", icon: Users },
  { id: "messages", label: "Messages", icon: Mail },
  { id: "finance", label: "Dépôts & retraits", icon: WalletIcon },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "paymentlinks", label: "Liens de paiement", icon: Link2 },
  { id: "audit", label: "Journal d'audit", icon: ScrollText },
];

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");

  if (user?.role !== "admin") {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16 text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 font-heading text-2xl font-bold">Accès réservé aux administrateurs</h1>
        <p className="mt-2 text-muted-foreground">Vous n'avez pas les permissions nécessaires pour accéder à cet espace.</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-1.5 rounded-xl gradient-novatrax px-5 py-2.5 text-sm font-semibold text-white">Retour au tableau de bord</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <ShieldCheck className="h-3.5 w-3.5" /> Espace administrateur
      </span>
      <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold">Administration</h1>
      <p className="mt-2 text-muted-foreground">Gérez la plateforme NOVATRAX : utilisateurs, contenus et sécurité.</p>

      <div className="mt-6 flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-border bg-card p-1.5 shadow-card">
        {TABS.map((t) => {
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

      <div className="mt-6">
        {tab === "overview" && <Overview />}
        {tab === "users" && (
          <div className="space-y-6">
            <UserSearchSection />
            <UsersManager adminEmail={user?.email} />
          </div>
        )}
        {tab === "finance" && (
          <div className="space-y-6">
            <DepositReviewsAdmin />
            <DepositsAdmin />
            <WithdrawalsAdmin />
          </div>
        )}
        {tab === "messages" && <MessagesAdmin />}
        {tab === "marketplace" && <MarketplaceAdmin />}
        {tab === "paymentlinks" && <PaymentLinksAdmin />}
        {tab === "audit" && <AuditLogView />}
      </div>
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState({ members: null, formations: null, apps: null, audits: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [users, forms, apps, audits] = await Promise.all([
          api.entities.User.filter({}).then((r) => (Array.isArray(r) ? r : r.items || []).length).catch(() => null),
          api.entities.Formation.count().catch(() => null),
          api.entities.Application.count().catch(() => null),
          api.entities.AuditLog.filter({}, { limit: 100 }).then((r) => r.items?.length ?? 0).catch(() => null),
        ]);
        setStats({ members: users, formations: forms, apps, audits });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dash = (v) => (v === null ? "—" : v);
  const cards = [
    { label: "Membres inscrits", value: loading ? "…" : dash(stats.members), icon: Users, color: "from-blue-500 to-blue-600", to: "/admin" },
    { label: "Formations", value: loading ? "…" : dash(stats.formations), icon: GraduationCap, color: "from-violet-500 to-violet-600", to: "/formation" },
    { label: "Applications Pro", value: loading ? "…" : dash(stats.apps), icon: Smartphone, color: "from-blue-600 to-violet-600", to: "/apk-pro" },
    { label: "Actions journalisées", value: loading ? "…" : dash(stats.audits), icon: ScrollText, color: "from-violet-600 to-blue-500", to: "/admin" },
  ];

  return (
    <div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${c.color} text-white`}>
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-2xl font-heading font-bold">{c.value}</p>
              <p className="text-sm text-muted-foreground">{c.label}</p>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 font-heading text-lg font-bold">Gestion des contenus</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Link to="/formation" className="group rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet/10 text-violet"><GraduationCap className="h-6 w-6" /></span>
          <div className="flex-1">
            <p className="font-semibold">Formations</p>
            <p className="text-sm text-muted-foreground">Ajouter, modifier, publier ou supprimer</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link to="/apk-pro" className="group rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Smartphone className="h-6 w-6" /></span>
          <div className="flex-1">
            <p className="font-semibold">Applications Pro</p>
            <p className="text-sm text-muted-foreground">Gérer le catalogue des APK</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link to="/contact" className="group rounded-2xl border border-border bg-card p-5 shadow-card hover:shadow-card-hover transition-all flex items-center gap-4 sm:col-span-2">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600"><FileSpreadsheet className="h-6 w-6" /></span>
          <div className="flex-1">
            <p className="font-semibold">Contacts & exports</p>
            <p className="text-sm text-muted-foreground">Consulter les membres, filtrer et exporter en CSV / VCF</p>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

function UsersManager({ adminEmail }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.entities.User.filter({});
      const list = Array.isArray(res) ? res : res.items || [];
      list.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
      setUsers(list);
    } catch (e) {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSuspend = async (u) => {
    const next = u.account_status === "suspended" ? "active" : "suspended";
    setBusy((b) => ({ ...b, [u.id]: true }));
    try {
      await api.entities.User.update(u.id, { account_status: next });
      await api.entities.AuditLog.create({
        action: next === "suspended" ? "user_suspend" : "user_reactivate",
        admin_email: adminEmail || "admin",
        details: `Utilisateur: ${u.email}`,
      });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, account_status: next } : x)));
    } catch (e) {
      alert("Action impossible : " + (e?.message || "erreur"));
    } finally {
      setBusy((b) => ({ ...b, [u.id]: false }));
    }
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [u.first_name, u.last_name, u.email, u.full_name].filter(Boolean).some((v) => v.toLowerCase().includes(q));
  });

  return (
    <div>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un utilisateur…"
          className="w-full rounded-xl border border-border pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </div>

      {loading ? (
        <div className="mt-4 space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />)}</div>
      ) : (
        <div className="mt-4 rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((u) => {
              const c = getCountry(u.country);
              const d = u.created_date ? new Date(u.created_date) : null;
              const suspended = u.account_status === "suspended";
              return (
                <div key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-muted/30">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl gradient-novatrax text-white text-sm font-bold">
                    {(u.first_name?.[0] || u.email?.[0] || "U").toUpperCase()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.full_name || u.email}</p>
                      {u.role === "admin" && <span className="text-[10px] font-semibold uppercase rounded-full bg-primary/10 text-primary px-2 py-0.5">Admin</span>}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{u.email} {c ? `• ${c.flag} ${c.name}` : ""} {d ? `• ${d.toLocaleDateString("fr-FR")}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${suspended ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600"}`}>
                      {suspended ? "Suspendu" : "Actif"}
                    </span>
                    <button
                      onClick={() => toggleSuspend(u)}
                      disabled={busy[u.id]}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50 ${
                        suspended ? "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/5" : "border-destructive/30 text-destructive hover:bg-destructive/5"
                      }`}
                    >
                      {suspended ? <><CheckCircle2 className="h-3.5 w-3.5" /> Réactiver</> : <><Ban className="h-3.5 w-3.5" /> Suspendre</>}
                    </button>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && <p className="p-8 text-center text-muted-foreground">Aucun utilisateur trouvé.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLogView() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.entities.AuditLog.filter({}, { sort: "-created_date", limit: 100 });
        setLogs(res.items || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const actionLabel = (a) => ({
    contact_export_csv: "Export CSV des contacts",
    contact_export_vcf: "Export VCF des contacts",
    user_suspend: "Suspension d'utilisateur",
    user_reactivate: "Réactivation d'utilisateur",
    user_block: "Blocage d'un compte",
    user_unblock: "Déblocage d'un compte",
    user_email_manual_verify: "Vérification manuelle d'e-mail",
    user_access_manual_activate: "Activation de l'accès Pro (sans dépôt)",
    welcome_bonus_unlocked: "Bonus de bienvenue débloqué",
    admin_user_sheet_view: "Consultation de fiche utilisateur",
    commission_blocked_suspended: "Commission suspendue (compte bloqué)",
    formation_create: "Création de formation",
    formation_update: "Modification de formation",
    formation_delete: "Suppression de formation",
    commission_blocked_review: "Double dépôt détecté — commissions bloquées",
    affiliate_commissions_generated: "Commissions d'affiliation générées",
    deposit_review_confirm_anomaly: "Anomalie de dépôt confirmée",
    deposit_review_release_commissions: "Commissions débloquées après examen",
    deposit_review_refuse_claim: "Réclamation de dépôt refusée",
    deposit_review_refund_second: "Remboursement / traitement du 2ᵉ paiement",
    marketplace_product_submit: "Annonce Marketplace soumise à validation",
    marketplace_product_blocked: "Annonce Marketplace bloquée automatiquement",
    marketplace_product_update: "Annonce Marketplace modifiée",
    marketplace_product_delete: "Annonce Marketplace supprimée",
    marketplace_seller_auto_suspended: "Vendeur suspendu automatiquement (infractions répétées)",
    marketplace_purchase_init: "Commande Marketplace initiée",
    marketplace_webhook: "Confirmation de paiement Marketplace (LeekPay)",
    marketplace_order_completed: "Vente Marketplace terminée — vendeur crédité",
    marketplace_order_disputed: "Litige Marketplace ouvert",
    marketplace_admin_product: "Modération d'annonce Marketplace",
    marketplace_admin_category: "Gestion des catégories Marketplace",
    marketplace_admin_rule: "Gestion des règles Marketplace",
    marketplace_admin_order: "Décision administrative sur une commande Marketplace",
    marketplace_admin_seller_ban: "Bannissement Marketplace d'un vendeur",
    marketplace_admin_seller_unban: "Rétablissement Marketplace d'un vendeur",
    payment_link_create: "Création d'un lien de paiement",
    payment_link_update: "Modification d'un lien de paiement",
    payment_link_toggle: "Lien de paiement activé / mis en pause",
    payment_link_delete: "Suppression d'un lien de paiement",
    payment_link_purchase_init: "Paiement initié via un lien de paiement",
    payment_link_webhook: "Paiement confirmé via lien de paiement (LeekPay)",
  }[a] || a);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-primary" />
        <h2 className="font-heading text-lg font-bold">Journal des actions sensibles</h2>
      </div>
      {loading ? (
        <div className="p-5 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />)}</div>
      ) : logs.length === 0 ? (
        <p className="p-8 text-center text-muted-foreground">Aucune action journalisée pour le moment.</p>
      ) : (
        <div className="divide-y divide-border">
          {logs.map((l) => {
            const d = l.created_date ? new Date(l.created_date) : null;
            return (
              <div key={l.id} className="p-4 flex items-start gap-3">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{actionLabel(l.action)}</p>
                  <p className="text-xs text-muted-foreground">{l.admin_email}</p>
                  {l.details && <p className="text-xs text-muted-foreground/80 mt-0.5 break-words">{l.details}</p>}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{d ? d.toLocaleString("fr-FR") : "—"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}