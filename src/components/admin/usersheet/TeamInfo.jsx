import { formatFcfa } from "./helpers";

// Équipe d'affiliation réelle (structure referred_by, jamais modifiée) :
// chaque utilisateur compte une seule fois par niveau, N1 à N3 uniquement.
export default function TeamInfo({ team }) {
  const levels = [
    { n: 1, label: "Niveau 1 — Filleuls directs", count: team.level1_count },
    { n: 2, label: "Niveau 2 — Filleuls indirects", count: team.level2_count },
    { n: 3, label: "Niveau 3 — Troisième niveau", count: team.level3_count },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-heading text-base font-bold">Équipe / Filleuls</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {levels.map((l) => (
          <div key={l.n} className="rounded-xl bg-muted/50 p-4">
            <p className="text-2xl font-heading font-bold text-primary">{l.count}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-muted-foreground">{l.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 font-semibold">
          Total équipe N1 : {team.level1_count}
        </span>
        <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 font-semibold">
          Total équipe N2 : {team.level2_count}
        </span>
        <span className="rounded-full border border-border bg-muted/50 px-3 py-1.5 font-semibold">
          Total équipe N3 : {team.level3_count}
        </span>
        <span className="rounded-full gradient-novatrax px-3 py-1.5 font-semibold text-white">
          Total général : {team.total}
        </span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Comptage issu de la structure réelle de parrainage enregistrée (champ referred_by d'origine).
      </p>
    </div>
  );
}