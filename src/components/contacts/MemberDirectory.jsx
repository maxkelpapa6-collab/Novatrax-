import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import { downloadFile } from "@/lib/export";
import { getCountry } from "@/lib/countries";
import { useAuth } from "@/lib/AuthContext";
import FeatureLocked from "@/components/FeatureLocked";
import {
  Search, Download, Phone, MessageCircle, Loader2, Users, CalendarDays,
} from "lucide-react";

const RANGES = [
  { value: "all", label: "Tout" },
  { value: "today", label: "Aujourd'hui" },
  { value: "yesterday", label: "Hier" },
  { value: "week", label: "Cette semaine" },
  { value: "month", label: "Ce mois" },
  { value: "custom", label: "Date précise" },
];

const DIRECTORY_LIMIT = 50;

export default function MemberDirectory() {
  const { user } = useAuth();
  const locked = !!user && user.access_activated !== true;
  const [loading, setLoading] = useState(true);
  const [accessRefused, setAccessRefused] = useState(false);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(null);
  const [counts, setCounts] = useState(null);
  const [range, setRange] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [selectedCount, setSelectedCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const debounceRef = useRef(null);

  const rangeParams = useCallback(
    () => ({
      range,
      date_from: range === "custom" ? dateFrom : "",
      date_to: range === "custom" ? dateTo : "",
    }),
    [range, dateFrom, dateTo]
  );

  const handleError = (e, fallback) => {
    if (e?.response?.status === 403) {
      setAccessRefused(true);
      return;
    }
    setError(e?.response?.data?.error || e?.message || fallback);
  };

  const loadSummary = useCallback(async () => {
    if (locked) return;
    try {
      const res = await api.functions.invoke("downloadMemberContacts", { action: "summary" });
      setCounts(res.data?.counts || null);
      setConsent(res.data?.consent === true);
    } catch (e) {
      handleError(e, "Impossible de charger l'annuaire.");
    }
  }, [locked]);

  const loadDirectory = useCallback(async () => {
    if (locked) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.functions.invoke("downloadMemberContacts", {
        action: "directory",
        search: search.trim(),
        limit: DIRECTORY_LIMIT,
        ...rangeParams(),
      });
      setItems(res.data?.items || []);
      setSelectedCount(res.data?.count || 0);
      setTruncated(res.data?.truncated === true);
    } catch (e) {
      handleError(e, "Impossible de charger les contacts.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, search, rangeParams]);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(loadDirectory, 300);
    return () => clearTimeout(debounceRef.current);
  }, [loadDirectory]);

  const handleDownload = async () => {
    setDownloading(true);
    setError("");
    try {
      const res = await api.functions.invoke("downloadMemberContacts", {
        action: "download",
        format: "vcf",
        ...rangeParams(),
      });
      const { content, filename } = res.data || {};
      if (!content) throw new Error("Fichier vide.");
      downloadFile(
        filename || "NOVATRAX_CONTACTS.vcf",
        content,
        String(filename).endsWith(".csv") ? "text/csv;charset=utf-8" : "text/vcard;charset=utf-8"
      );
    } catch (e) {
      handleError(e, "Téléchargement impossible.");
    } finally {
      setDownloading(false);
    }
  };

  if (locked || accessRefused) {
    return (
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold uppercase tracking-tight">Contacts NOVATRAX</h1>
        <div className="mt-6"><FeatureLocked /></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <h1 className="font-heading text-2xl sm:text-3xl font-bold uppercase tracking-tight">Contacts NOVATRAX</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Répertoire des membres ayant accepté le partage de leurs coordonnées.
      </p>

      {/* Recherche */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un nom ou un numéro…"
          className="w-full rounded-xl border border-border bg-card pl-9 pr-3 py-3 text-sm outline-none focus:border-primary shadow-card"
        />
      </div>

      {/* Périodes */}
      <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              range === r.value
                ? "gradient-novatrax text-white shadow-card"
                : "border border-border bg-card text-foreground hover:bg-muted"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {range === "custom" && (
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-3 shadow-card">
          <label className="text-xs font-medium text-muted-foreground">
            Inscrits depuis
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
          <label className="text-xs font-medium text-muted-foreground">
            Jusqu'au
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs"
            />
          </label>
        </div>
      )}

      {/* Compteur */}
      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            <p className="text-muted-foreground">
              Contacts disponibles : <span className="font-bold text-foreground">{counts?.total ?? "…"}</span>
            </p>
            {range === "today" && (
              <p className="text-muted-foreground">
                Inscrits aujourd'hui : <span className="font-bold text-foreground">{counts?.today ?? "…"}</span>
              </p>
            )}
            <p className="text-muted-foreground">
              Contacts sélectionnés : <span className="font-bold text-foreground">{selectedCount}</span>
            </p>
          </div>
          <button
            onClick={() => { setRange("all"); setSearch(""); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            <Users className="h-3.5 w-3.5" /> Tout sélectionner
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {consent === false && (
        <p className="mt-3 rounded-xl border border-violet/30 bg-violet/5 px-4 py-2.5 text-xs text-muted-foreground">
          Vous n'apparaissez pas dans l'annuaire. Activez le partage de vos coordonnées depuis{" "}
          <Link to="/profile" className="font-semibold text-violet hover:underline">Mon profil</Link>.
        </p>
      )}

      {/* Liste */}
      {loading ? (
        <div className="mt-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-[74px] rounded-2xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Aucun contact ne correspond à cette sélection.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {items.map((m) => (
            <ContactRow key={m.id} m={m} />
          ))}
        </div>
      )}

      {truncated && !loading && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Affichage limité à {DIRECTORY_LIMIT} contacts — le téléchargement contiendra les {selectedCount} contacts sélectionnés.
        </p>
      )}

      {/* Téléchargement */}
      <button
        onClick={handleDownload}
        disabled={downloading || selectedCount === 0}
        className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl gradient-novatrax px-5 py-4 text-sm font-bold uppercase tracking-wide text-white shadow-card hover:shadow-card-hover disabled:opacity-50"
      >
        {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
        {downloading ? "Génération du fichier…" : `Télécharger ${selectedCount} contact${selectedCount > 1 ? "s" : ""}`}
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">
        Fichier NOVATRAX_CONTACTS.vcf — importable sur iPhone, Android, Samsung, Google Contacts et Apple Contacts.
      </p>
    </div>
  );
}

function ContactRow({ m }) {
  const waNumber = m.phone ? m.phone.replace(/[^\d]/g, "") : "";
  const c = getCountry(m.country);
  const d = m.created_date ? new Date(m.created_date) : null;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full gradient-novatrax text-sm font-bold text-white">
        {(m.name || "N").charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{m.name}</p>
        <p className="truncate text-sm text-muted-foreground">
          {m.phone}
          {c ? ` · ${c.flag}` : ""}
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarDays className="h-3 w-3" />
          Inscrit le {d ? d.toLocaleDateString("fr-FR") : "—"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {waNumber && (
          <a
            href={`https://wa.me/${waNumber}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
          >
            <MessageCircle className="h-4 w-4" />
          </a>
        )}
        <a
          href={`tel:${m.phone}`}
          aria-label="Appeler"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary/20"
        >
          <Phone className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}