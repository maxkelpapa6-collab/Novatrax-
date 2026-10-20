import { useEffect, useState, useMemo, useCallback } from "react";
import { api } from "@/api/client";
import { COUNTRIES, getCountry } from "@/lib/countries";
import { usersToCSV, usersToVCF, downloadCSV, downloadVCF } from "@/lib/export";
import {
  Users, Search, FileSpreadsheet, Contact as ContactIcon, X, Mail, Phone,
  Filter, ChevronLeft, ChevronRight, ShieldAlert, Eye, Share2,
} from "lucide-react";

const PAGE_SIZE = 10;
const TZ = "Africa/Lome";
const localDay = (d) => (d ? new Intl.DateTimeFormat("fr-CA", { timeZone: TZ }).format(new Date(d)) : null);
const todayLocal = () => new Intl.DateTimeFormat("fr-CA", { timeZone: TZ }).format(new Date());

export default function AdminContacts({ adminEmail }) {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [consentFilter, setConsentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.entities.User.filter({});
      const list = Array.isArray(res) ? res : res.items || [];
      list.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
      setAll(list);
    } catch (e) {
      setError(e?.message || "Accès refusé : vous n'êtes pas autorisé à consulter les contacts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const today = todayLocal();
    const shareable = all.filter(
      (u) => u.share_contacts === true && u.phone && (u.account_status || "active") !== "suspended"
    ).length;
    const newToday = all.filter((u) => localDay(u.created_date) === today).length;
    return { total: all.length, shareable, newToday };
  }, [all]);

  const filtered = useMemo(() => {
    let list = all;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((u) =>
        [u.first_name, u.last_name, u.email, u.phone, u.full_name, u.username]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(q))
      );
    }
    if (countryFilter) list = list.filter((u) => u.country === countryFilter);
    if (statusFilter) list = list.filter((u) => (u.account_status || "active") === statusFilter);
    if (consentFilter) list = list.filter((u) => (u.share_contacts === true ? "shared" : "refused") === consentFilter);
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((u) => u.created_date && new Date(u.created_date) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
      list = list.filter((u) => u.created_date && new Date(u.created_date) <= to);
    }
    return list;
  }, [all, search, countryFilter, statusFilter, consentFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const logAndExport = async (format, records) => {
    setExporting(true);
    try {
      await api.entities.AuditLog.create({
        action: format === "csv" ? "contact_export_csv" : "contact_export_vcf",
        admin_email: adminEmail || "admin",
        details: `${records.length} contact(s) exporté(s). Filtres: ${search ? `recherche="${search}" ` : ""}${countryFilter ? `pays=${countryFilter} ` : ""}${statusFilter ? `statut=${statusFilter} ` : ""}${consentFilter ? `partage=${consentFilter} ` : ""}${dateFrom || dateTo ? `date=${dateFrom || "…"}→${dateTo || "…"}` : ""}`.trim(),
      });
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "csv") downloadCSV(`novatrax_contacts_${stamp}.csv`, usersToCSV(records));
      else downloadVCF(`NOVATRAX_CONTACTS_${stamp}.vcf`, usersToVCF(records));
    } catch (e) {
      alert("Export impossible : " + (e?.message || "erreur"));
    } finally {
      setExporting(false);
    }
  };

  const hasFilters = search || countryFilter || statusFilter || consentFilter || dateFrom || dateTo;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Users className="h-3.5 w-3.5" /> Administration — Contacts
          </span>
          <h1 className="mt-3 font-heading text-3xl sm:text-4xl font-bold">Contacts des membres</h1>
          <p className="mt-2 text-muted-foreground">Coordonnées et consentements de partage. Accès réservé aux administrateurs.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => logAndExport("vcf", filtered)}
            disabled={exporting || filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <ContactIcon className="h-4 w-4" /> Export VCF
          </button>
          <button
            onClick={() => logAndExport("csv", filtered)}
            disabled={exporting || filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Compteurs */}
      <div className="mt-6 grid grid-cols-3 gap-3">
        <StatCard label="Utilisateurs inscrits" value={stats.total} />
        <StatCard label="Contacts partageables" value={stats.shareable} accent />
        <StatCard label="Nouveaux aujourd'hui" value={stats.newToday} />
      </div>

      {/* Filters */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              placeholder="Rechercher par nom, téléphone ou e-mail…"
              className="w-full rounded-xl border border-border pl-9 pr-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <select value={countryFilter} onChange={(e) => { setCountryFilter(e.target.value); resetPage(); }} className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary">
            <option value="">Tous les pays</option>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetPage(); }} className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary">
            <option value="">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="suspended">Suspendu</option>
          </select>
          <select value={consentFilter} onChange={(e) => { setConsentFilter(e.target.value); resetPage(); }} className="rounded-xl border border-border px-3 py-2.5 text-sm outline-none focus:border-primary">
            <option value="">Tous les partages</option>
            <option value="shared">Partage accepté</option>
            <option value="refused">Partage refusé</option>
          </select>
        </div>
        <div className="mt-3 flex flex-col sm:flex-row gap-3 items-end">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-2">
            <Filter className="h-3.5 w-3.5" /> Date d'inscription
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage(); }} className="rounded-lg border border-border px-2 py-1.5 text-xs" />
            <span>→</span>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage(); }} className="rounded-lg border border-border px-2 py-1.5 text-xs" />
          </label>
          {hasFilters && (
            <button onClick={() => { setSearch(""); setCountryFilter(""); setStatusFilter(""); setConsentFilter(""); setDateFrom(""); setDateTo(""); resetPage(); }} className="text-xs font-semibold text-primary hover:underline">
              Réinitialiser les filtres
            </button>
          )}
          <span className="sm:ml-auto text-xs text-muted-foreground">{filtered.length} membre(s)</span>
        </div>
      </div>

      {/* Table (desktop) / cards (mobile) */}
      {loading ? (
        <div className="mt-6 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl bg-muted/50 animate-pulse" />)}
        </div>
      ) : error ? (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : pageItems.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Aucun membre ne correspond à votre recherche.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="mt-6 hidden lg:block overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-4 py-3">Nom</th>
                  <th className="text-left font-semibold px-4 py-3">Pays</th>
                  <th className="text-left font-semibold px-4 py-3">Téléphone</th>
                  <th className="text-left font-semibold px-4 py-3">E-mail</th>
                  <th className="text-left font-semibold px-4 py-3">Inscription</th>
                  <th className="text-left font-semibold px-4 py-3">Statut</th>
                  <th className="text-left font-semibold px-4 py-3">Partage</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageItems.map((u) => {
                  const c = getCountry(u.country);
                  const d = u.created_date ? new Date(u.created_date) : null;
                  return (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-semibold">
                        {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.full_name || "—"}
                      </td>
                      <td className="px-4 py-3">{c ? `${c.flag} ${c.name}` : "—"}</td>
                      <td className="px-4 py-3">{u.phone || "—"}</td>
                      <td className="px-4 py-3 truncate max-w-[200px]">{u.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">{d ? d.toLocaleDateString("fr-FR") : "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={u.account_status} /></td>
                      <td className="px-4 py-3"><ConsentBadge shared={u.share_contacts === true} /></td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => setSelected(u)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
                          <Eye className="h-3.5 w-3.5" /> Fiche
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mt-6 lg:hidden space-y-3">
            {pageItems.map((u) => {
              const c = getCountry(u.country);
              const d = u.created_date ? new Date(u.created_date) : null;
              return (
                <div key={u.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.full_name || "—"}</p>
                      <p className="text-sm text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={u.account_status} />
                      <ConsentBadge shared={u.share_contacts === true} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <p className="text-muted-foreground">{c ? `${c.flag} ${c.name}` : "—"}</p>
                    <p className="text-muted-foreground">{u.phone || "—"}</p>
                    <p className="text-muted-foreground col-span-2">Inscrit le {d ? d.toLocaleDateString("fr-FR") : "—"}</p>
                  </div>
                  <button onClick={() => setSelected(u)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted">
                    <Eye className="h-3.5 w-3.5" /> Voir la fiche
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {currentPage} / {totalPages}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-muted">
                  <ChevronLeft className="h-4 w-4" /> Précédent
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-muted">
                  Suivant <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {selected && <UserDetail user={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card text-center">
      <p className={`font-heading text-2xl font-bold ${accent ? "text-gradient-novatrax" : ""}`}>{value}</p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusBadge({ status }) {
  const suspended = status === "suspended";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${suspended ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${suspended ? "bg-destructive" : "bg-emerald-500"}`} />
      {suspended ? "Suspendu" : "Actif"}
    </span>
  );
}

function ConsentBadge({ shared }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${shared ? "bg-violet/10 text-violet" : "bg-muted text-muted-foreground"}`}>
      <Share2 className="h-3 w-3" />
      {shared ? "Partagé" : "Refusé"}
    </span>
  );
}

function UserDetail({ user: u, onClose }) {
  const c = getCountry(u.country);
  const d = u.created_date ? new Date(u.created_date) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-card-hover max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-heading text-lg font-bold">Fiche membre</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-novatrax text-white text-lg font-bold">
              {(u.first_name?.[0] || u.email?.[0] || "U").toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="font-heading text-lg font-bold">{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.full_name || "—"}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={u.account_status} />
                <ConsentBadge shared={u.share_contacts === true} />
              </div>
            </div>
          </div>
          <DetailRow icon={Mail} label="E-mail" value={u.email} />
          <DetailRow icon={Phone} label="Téléphone" value={u.phone || "—"} />
          <DetailRow label="Pays" value={c ? `${c.flag} ${c.name} (${c.dialCode})` : "—"} />
          <DetailRow label="Rôle" value={u.role === "admin" ? "Administrateur" : "Membre"} />
          <DetailRow label="Date d'inscription" value={d ? d.toLocaleString("fr-FR") : "—"} />
          <DetailRow label="Partage de ses coordonnées" value={u.share_contacts === true ? "Accepté" : "Refusé"} />
          <DetailRow label="Identifiant" value={u.id} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border p-3">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold break-words">{value}</p>
      </div>
    </div>
  );
}