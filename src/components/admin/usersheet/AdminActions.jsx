import { ScrollText } from "lucide-react";
import { auditActionLabel, formatDateTime } from "./helpers";

// Actions administratives déjà effectuées sur ce compte (journal d'audit).
export default function AdminActions({ audit }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2">
        <ScrollText className="h-5 w-5 text-primary" />
        <h3 className="font-heading text-base font-bold">Actions administratives sur ce compte</h3>
      </div>
      {audit.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Aucune action administrative enregistrée pour ce compte.</p>
      ) : (
        <div className="mt-3 divide-y divide-border">
          {audit.map((a, i) => (
            <div key={i} className="flex items-start gap-3 py-2.5">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{auditActionLabel(a.action)}</p>
                <p className="text-xs text-muted-foreground">
                  {a.admin_email} • {formatDateTime(a.date)}
                </p>
                {a.reason && <p className="text-xs text-muted-foreground/80">Motif : {a.reason}</p>}
                {a.details && <p className="text-xs text-muted-foreground/80 break-words">{a.details}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}