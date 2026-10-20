import { Image } from "@/components/ui/image";
import { formatFcfa } from "@/lib/commissions";
import { Copy, Pencil, Pause, Play, Trash2 } from "lucide-react";

const STATUS_BADGES = {
  active: { label: "Actif", cls: "bg-emerald-500/10 text-emerald-600" },
  paused: { label: "En pause", cls: "bg-amber-500/10 text-amber-600" },
  blocked: { label: "Bloqué par l'administration", cls: "bg-destructive/10 text-destructive" },
};

// Carte d'un lien de paiement dans l'espace créateur : aperçu, statut, lien
// partageable et actions (copier, modifier, pause / activer, supprimer).
export default function PaymentLinkCard({ link, onCopy, onEdit, onToggle, onDelete, busy = false }) {
  const badge = STATUS_BADGES[link.status] || { label: link.status, cls: "bg-muted text-muted-foreground" };
  const priceLabel =
    link.price_type === "fixed"
      ? formatFcfa(link.price_fcfa)
      : `Libre · ${formatFcfa(link.min_fcfa)} – ${formatFcfa(link.max_fcfa)}`;

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="relative aspect-[4/3] bg-muted">
          {link.profile_image && <Image src={link.profile_image} alt={link.name} className="h-full w-full" fittingType="fill" />}
        </div>
        <div className="space-y-1.5 p-3">
          <p className="line-clamp-2 text-sm font-semibold">{link.name}</p>
          <p className="font-heading text-lg font-bold text-primary">{priceLabel}</p>
        </div>
      </div>
      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.cls}`}>{badge.label}</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onCopy}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-50"
        >
          <Copy className="h-3 w-3" /> Copier le lien
        </button>
        <button onClick={onEdit} disabled={busy || link.status === "blocked"} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">
          <Pencil className="h-3 w-3" /> Modifier
        </button>
        {link.status !== "blocked" && (
          <button onClick={onToggle} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold hover:bg-muted disabled:opacity-50">
            {link.status === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            {link.status === "active" ? "Pause" : "Activer"}
          </button>
        )}
        <button onClick={onDelete} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-destructive/30 px-2 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}