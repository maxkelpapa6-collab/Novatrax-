// Aides d'affichage partagées par les sections de la fiche utilisateur Admin.
export function formatFcfa(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("fr-FR") + " FCFA";
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return (
    d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) +
    " à " +
    d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

export const HISTORY_KIND_LABELS = {
  deposit: "Dépôt",
  deposit_access_fee: "Dépôt — frais d'accès",
  withdrawal: "Retrait",
  commission_n1: "Commission N1",
  commission_n2: "Commission N2",
  commission_n3: "Commission N3",
  adjustment: "Ajustement administratif",
};

export function withdrawalStatusLabel(status) {
  if (status === "pending" || status === "processing") return "EN ATTENTE";
  if (status === "approved" || status === "paid") return "VALIDÉ";
  return "REFUSÉ";
}

export function txStatusLabel(status) {
  return { pending: "EN ATTENTE", confirmed: "CONFIRMÉ", rejected: "REFUSÉ" }[status] || (status || "—").toUpperCase();
}

export function statusTone(status) {
  if (["confirmed", "approved", "paid"].includes(status)) return "bg-emerald-500/10 text-emerald-600";
  if (["rejected", "failed"].includes(status)) return "bg-destructive/10 text-destructive";
  return "bg-amber-500/10 text-amber-600";
}

export function auditActionLabel(a) {
  return (
    {
      user_block: "Blocage du compte",
      user_unblock: "Déblocage du compte",
      user_email_manual_verify: "Vérification manuelle de l'e-mail",
      user_access_manual_activate: "Activation manuelle de l'accès Pro (sans dépôt)",
      admin_user_sheet_view: "Consultation de la fiche",
      commission_blocked_review: "Commissions bloquées (double dépôt)",
      commission_blocked_suspended: "Commission suspendue (compte bloqué)",
      affiliate_commissions_generated: "Commissions d'affiliation générées",
      deposit_confirm: "Confirmation de dépôt",
      deposit_reject: "Rejet de dépôt",
      withdrawal_examine: "Examen de retrait",
      withdrawal_approve: "Approbation de retrait",
      withdrawal_reject: "Rejet de retrait",
      withdrawal_mark_paid: "Retrait marqué payé",
    }[a] || a
  );
}