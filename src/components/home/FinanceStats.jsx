import { ArrowDownCircle, TrendingUp, Wallet, ArrowUpFromLine } from "lucide-react";
import { formatFcfa } from "@/lib/commissions";

// Statistiques financières réelles de l'utilisateur, calculées côté serveur
export default function FinanceStats({ stats, loading }) {
  const cards = [
    {
      icon: ArrowDownCircle,
      label: "Dépenses totales",
      value: stats?.deposits_total,
      accent: "bg-blue-500/10 text-blue-600",
    },
    {
      icon: TrendingUp,
      label: "Gains confirmés",
      value: stats?.commissions_confirmed,
      accent: "bg-violet-500/10 text-violet-600",
      sub: stats ? `En attente : ${formatFcfa(stats.commissions_pending)}` : null,
    },
    {
      icon: Wallet,
      label: "Solde actuel",
      value: stats?.balance,
      accent: "bg-emerald-500/10 text-emerald-600",
    },
    {
      icon: ArrowUpFromLine,
      label: "Retraits totaux",
      value: stats?.withdrawals_total,
      accent: "bg-rose-500/10 text-rose-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${c.accent}`}>
              <Icon className="h-5 w-5" />
            </span>
            <p className="mt-4 text-lg sm:text-2xl font-heading font-bold tracking-tight">
              {loading ? "…" : formatFcfa(c.value ?? 0)}
            </p>
            <p className="text-sm text-muted-foreground">{c.label}</p>
            {c.sub && <p className="mt-1 text-xs text-muted-foreground/80">{c.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}