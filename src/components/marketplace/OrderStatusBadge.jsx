// Badge de statut d'une commande Marketplace (parcours d'achat complet :
// attente de paiement → paiement confirmé → terminée / annulée / remboursée / litige).
const MAP = {
  awaiting_payment: { label: "En attente de paiement", cls: "bg-amber-500/10 text-amber-600" },
  processing: { label: "Paiement confirmé — en cours", cls: "bg-primary/10 text-primary" },
  completed: { label: "Terminée", cls: "bg-emerald-500/10 text-emerald-600" },
  cancelled: { label: "Annulée", cls: "bg-muted text-muted-foreground" },
  refunded: { label: "Remboursée", cls: "bg-destructive/10 text-destructive" },
  disputed: { label: "En litige", cls: "bg-destructive/10 text-destructive" },
};

export default function OrderStatusBadge({ status }) {
  const item = MAP[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${item.cls}`}>
      {item.label}
    </span>
  );
}