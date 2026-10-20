import { Link } from "react-router-dom";
import { useMemberHome } from "@/hooks/useMemberHome";
import { LEVEL_COMMISSIONS, formatFcfa, formatRate } from "@/lib/commissions";
import { getCountry } from "@/lib/countries";
import { Users, ChevronLeft, ShieldAlert, RefreshCw } from "lucide-react";
import FeatureLocked from "@/components/FeatureLocked";
import ReferralQuickCopy from "@/components/network/ReferralQuickCopy";

// Page détaillée du réseau : filleuls réels par niveau et commissions configurées
export default function MyNetwork() {
  const { data, isLoading: loading, isError, error: fetchError, refetch } = useMemberHome(true);
  const error = isError
    ? (fetchError?.response?.data?.error || fetchError?.message || "Impossible de charger votre réseau.")
    : "";

  const levels = [
    { level: 1, members: data?.network?.members?.level1 || [], count: data?.network?.level1_count ?? 0 },
    { level: 2, members: data?.network?.members?.level2 || [], count: data?.network?.level2_count ?? 0 },
    { level: 3, members: data?.network?.members?.level3 || [], count: data?.network?.level3_count ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> Tableau de bord
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-violet/15 text-violet">
          <Users className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-heading text-2xl font-bold">Mon réseau d’affiliation</h1>
          <p className="text-sm text-muted-foreground">
            Vos filleuls et les commissions configurées par niveau.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col items-center gap-3 text-center">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={refetch} className="inline-flex items-center gap-2 rounded-xl gradient-novatrax px-4 py-2.5 text-sm font-semibold text-white">
            <RefreshCw className="h-4 w-4" /> Réessayer
          </button>
        </div>
      ) : data?.access?.activated === false ? (
        <div className="mt-6"><FeatureLocked /></div>
      ) : loading ? (
        <div className="mt-6 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />)}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {data?.referral_code && <ReferralQuickCopy code={data.referral_code} />}
          {LEVEL_COMMISSIONS.map((lc, i) => {
            const lvl = levels[i];
            return (
              <section key={lc.level} className="rounded-2xl border border-border bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-heading text-lg font-bold">Niveau {lc.level}</h2>
                  <p className="text-sm text-muted-foreground">
                    Commission : <span className="font-semibold text-violet">{formatRate(lc.rate)}</span> de leurs achats Marketplace
                  </p>
                </div>
                <p className="mt-1 text-sm font-semibold">
                  {lvl.count} membre{lvl.count > 1 ? "s" : ""}
                </p>

                {lvl.members.length === 0 ? (
                  <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                    Aucun membre à ce niveau pour le moment.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-border">
                    {lvl.members.map((m) => {
                      const c = getCountry(m.country);
                      const d = m.created_date ? new Date(m.created_date) : null;
                      return (
                        <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
                              {m.first_name || m.username || "Membre"}
                              {m.deposit_status === "CONFIRMED" ? (
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">1ᵉʳ dépôt confirmé</span>
                              ) : m.deposit_status === "REVIEW_REQUIRED" ? (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">Dépôt en examen</span>
                              ) : (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Dépôt en attente</span>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {m.username ? `@${m.username}` : "—"}{c ? ` · ${c.flag} ${c.name}` : ""}
                            </p>
                          </div>
                          <p className="shrink-0 text-xs text-muted-foreground">
                            {d ? d.toLocaleDateString("fr-FR") : ""}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {data?.network?.counts_capped && lvl.members.length >= 100 && (
                  <p className="mt-2 text-xs text-muted-foreground">Affichage des 100 membres les plus récents.</p>
                )}
              </section>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Les commissions sont calculées uniquement sur les achats Marketplace réellement effectués par votre réseau : les inscriptions ne déclenchent aucune commission.
            Les montants indiqués ne constituent pas des gains garantis.
          </p>
        </div>
      )}
    </div>
  );
}