export const MIN_DEPOSIT_FCFA = 3000;
export const MIN_WITHDRAWAL_FCFA = 1500;
export const ACCESS_FEE_FCFA = 3000;
export const WITHDRAWAL_RESERVED_STATUSES = ["pending", "processing", "approved", "paid"];
// Bonus de bienvenue : offert à chaque nouveau membre dès son inscription,
// débloqué automatiquement (côté serveur) dès l'activation de son propre
// accès — il ne dépend jamais du recrutement d'autres membres.
export const WELCOME_BONUS_FCFA = 500;

export async function computeAvailableBalance(svc, userId) {
  const credits = await svc.entities.Transaction.aggregate({
    query: {
      user_id: userId,
      status: "confirmed",
      type: { $in: ["deposit", "adjustment"] },
      // Les frais d'accès (3 000 FCFA) paient l'entrée sur la plateforme :
      // ils ne sont jamais retirables. $ne inclut les dépôts sans purpose.
      purpose: { $ne: "access_fee" }
    },
    sum: "amount_fcfa"
  });
  const debits = await svc.entities.Withdrawal.aggregate({
    query: { user_id: userId, status: { $in: WITHDRAWAL_RESERVED_STATUSES } },
    sum: "amount_fcfa"
  });
  const creditTotal = (credits.rows && credits.rows[0] && credits.rows[0].sum_amount_fcfa) || 0;
  const debitTotal = (debits.rows && debits.rows[0] && debits.rows[0].sum_amount_fcfa) || 0;
  return creditTotal - debitTotal;
}