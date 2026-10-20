import PersonalInfo from "./PersonalInfo";
import FinanceInfo from "./FinanceInfo";
import TeamInfo from "./TeamInfo";
import CommissionsInfo from "./CommissionsInfo";
import HistoryInfo from "./HistoryInfo";
import AdminActions from "./AdminActions";
import BlockControls from "./BlockControls";
import AccessControls from "./AccessControls";
import { formatDateTime } from "./helpers";

// Fiche complète d'un utilisateur (espace Admin) : statut du compte,
// informations personnelles réelles, finances calculées côté serveur,
// équipe N1-N3, commissions, historique et actions administratives.
export default function UserSheet({ data, onRefresh }) {
  const u = data.user;
  const suspended = u.account_status === "suspended";
  const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || u.email;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl gradient-novatrax text-lg font-bold text-white">
            {(u.first_name?.[0] || u.email?.[0] || "U").toUpperCase()}
          </span>
          <div className="min-w-0">
            <h2 className="font-heading text-xl font-bold truncate">{fullName}</h2>
            <p className="text-sm text-muted-foreground truncate">{u.email}</p>
          </div>
        </div>

        {suspended ? (
          <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
            <p className="font-bold text-destructive">🔴 STATUT : COMPTE BLOQUÉ</p>
            <p className="mt-1 text-sm text-destructive/90">
              Bloqué le {formatDateTime(u.blocked_at)} par {u.blocked_by || "—"}
            </p>
            <p className="text-sm text-destructive/90">Motif : {u.blocked_reason || "—"}</p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
            <p className="font-bold text-emerald-700">🟢 STATUT : COMPTE ACTIF</p>
          </div>
        )}

        <BlockControls user={u} onDone={onRefresh} />
        <AccessControls user={u} onDone={onRefresh} />
      </div>

      <PersonalInfo user={u} sponsor={data.sponsor} />
      <FinanceInfo finance={data.finance} withdrawals={data.withdrawals} />
      <TeamInfo team={data.team} />
      <CommissionsInfo commissions={data.commissions} />
      <HistoryInfo history={data.history} />
      <AdminActions audit={data.audit} />
    </div>
  );
}