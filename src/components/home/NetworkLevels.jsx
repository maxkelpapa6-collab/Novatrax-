import { Link } from "react-router-dom";
import { Users, ChevronRight } from "lucide-react";
import { LEVEL_COMMISSIONS, formatFcfa, formatRate } from "@/lib/commissions";

// « Mon réseau d’affiliation » : compteurs réels par niveau + commissions configurées
export default function NetworkLevels({ network, loading }) {
  const counts = [
    network?.level1_count ?? 0,
    network?.level2_count ?? 0,
    network?.level3_count ?? 0,
  ];
  const totals = [
    network?.level_totals?.[0] ?? 0,
    network?.level_totals?.[1] ?? 0,
    network?.level_totals?.[2] ?? 0,
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-heading text-lg font-bold">Mon réseau d’affiliation</h2>
        <Link
          to="/reseau"
          className="inline-flex items-center gap-1 text-sm font-semibold text-violet hover:underline"
        >
          Voir mon réseau <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
        {LEVEL_COMMISSIONS.map((lc, i) => (
          <div
            key={lc.level}
            className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card"
          >
            <div className={`absolute inset-x-0 top-0 h-1 ${lc.level === 1 ? "bg-violet" : lc.level === 2 ? "bg-primary" : "bg-emerald-500"}`} />
            <div className="flex items-center justify-between">
              <p className="font-heading text-base font-bold">Niveau {lc.level}</p>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet/10 text-violet">
                <Users className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-2xl font-heading font-bold">
              {loading ? "…" : `${counts[i]} membre${counts[i] > 1 ? "s" : ""}`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Commission : <span className="font-semibold text-violet">{formatRate(lc.rate)}</span> de leurs achats Marketplace
            </p>
            <p className="mt-1 text-xs font-semibold text-emerald-600">
              Commissions reçues à ce niveau : {loading ? "…" : formatFcfa(totals[i])}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Les commissions sont versées uniquement sur les achats réels effectués sur la Marketplace par les membres de votre
        réseau — jamais sur les inscriptions. Elles ne constituent pas des gains garantis.
        Les compteurs sont calculés à partir des relations de parrainage réellement enregistrées.
      </p>
    </div>
  );
}