import { createClientFromRequest } from "../../lib/sdk.ts";
import { waitUntil } from "../../lib/runtime.ts";
import { requireActiveAdmin, logAdminAction } from "../../shared/adminGuard.ts";
import { filterUsers } from "../../shared/userQuery.ts";

// Fiche utilisateur complète pour l'administration NOVATRAX.
// Recherche par adresse e-mail exacte ; toutes les données (finances, équipe,
// commissions, historique, audit) sont lues et calculées côté serveur à
// partir des enregistrements réels — aucune valeur saisie à la main, aucune
// suppression ni modification de données. Accès strictement réservé aux
// administrateurs actifs : la fiche d'un membre n'est jamais exposée à un
// utilisateur non administrateur, quelle que soit la requête envoyée.

function txKind(t) {
  if (t.type === "deposit") return t.purpose === "access_fee" ? "deposit_access_fee" : "deposit";
  if (t.type === "withdrawal") return "withdrawal";
  if (t.type === "adjustment" && t.method === "affiliate_commission") {
    const m = /niveau\s+(\d)/i.exec(t.description || "");
    return m ? "commission_n" + m[1] : "adjustment";
  }
  return "adjustment";
}

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    }

    const sdk = createClientFromRequest(req);
    const { user: adminUser, error } = await requireActiveAdmin(sdk);
    if (error) return error;
    const admin = sdk.asServiceRole;

    // Recherche exacte sur l'adresse e-mail enregistrée
    const found = await admin.entities.User.filter({ email });
    const matches = Array.isArray(found) ? found : (found.items || []);
    const target = matches[0] || null;
    if (!target) {
      return Response.json({ ok: true, found: false });
    }

    // Parrain d'origine : referred_by est la référence permanente, jamais modifiée ici.
    let sponsor = null;
    if (target.referred_by) {
      const s = await admin.entities.User.get(target.referred_by).catch(() => null);
      if (s) {
        sponsor = { id: s.id, email: s.email || null, username: s.username || null, referral_code: s.referral_code || null };
      }
    }

    // Agrégations financières réelles (mêmes règles que le portefeuille membre)
    const [
      depositsByPurpose,
      adjustmentsByStatus,
      withdrawalByStatus,
      commissionsConfirmedByLevel,
      commissionsBlockedByLevel
    ] = await Promise.all([
      admin.entities.Transaction.aggregate({ query: { user_id: target.id, type: "deposit", status: "confirmed" }, groupBy: "purpose", sum: "amount_fcfa" }),
      admin.entities.Transaction.aggregate({ query: { user_id: target.id, type: "adjustment" }, groupBy: "status", sum: "amount_fcfa" }),
      admin.entities.Withdrawal.aggregate({ query: { user_id: target.id }, groupBy: "status", sum: "amount_fcfa" }),
      admin.entities.Commission.aggregate({ query: { beneficiary_id: target.id, status: "confirmed" }, groupBy: "level", sum: "amount_fcfa" }),
      admin.entities.Commission.aggregate({ query: { beneficiary_id: target.id, status: "blocked" }, groupBy: "level", sum: "amount_fcfa" })
    ]);

    let depositsTotal = 0;
    let accessFeeTotal = 0;
    for (const row of depositsByPurpose.rows || []) {
      const amount = row.sum_amount_fcfa || 0;
      if (row.purpose === "access_fee") accessFeeTotal += amount;
      else depositsTotal += amount;
    }

    let commissionsConfirmed = 0;
    let commissionsPending = 0;
    for (const row of adjustmentsByStatus.rows || []) {
      if (row.status === "confirmed") commissionsConfirmed = row.sum_amount_fcfa || 0;
      if (row.status === "pending") commissionsPending = row.sum_amount_fcfa || 0;
    }

    let withdrawalsPaid = 0;
    let withdrawalsReserved = 0;
    for (const row of withdrawalByStatus.rows || []) {
      const amount = row.sum_amount_fcfa || 0;
      if (row.status === "paid") withdrawalsPaid += amount;
      else if (["pending", "processing", "approved"].includes(row.status)) withdrawalsReserved += amount;
    }

    const balance = depositsTotal + commissionsConfirmed - withdrawalsReserved;

    const byLevel = { 1: { count: 0, earned: 0 }, 2: { count: 0, earned: 0 }, 3: { count: 0, earned: 0 } };
    let earnedTotal = 0;
    for (const row of commissionsConfirmedByLevel.rows || []) {
      const idx = Number(row.level);
      if (byLevel[idx]) {
        byLevel[idx].count = row.count || 0;
        byLevel[idx].earned = row.sum_amount_fcfa || 0;
        earnedTotal += row.sum_amount_fcfa || 0;
      }
    }
    const blockedByLevel = { 1: { count: 0, total: 0 }, 2: { count: 0, total: 0 }, 3: { count: 0, total: 0 } };
    let blockedTotal = 0;
    let blockedCount = 0;
    for (const row of commissionsBlockedByLevel.rows || []) {
      const idx = Number(row.level);
      if (blockedByLevel[idx]) {
        blockedByLevel[idx].count = row.count || 0;
        blockedByLevel[idx].total = row.sum_amount_fcfa || 0;
        blockedTotal += row.sum_amount_fcfa || 0;
        blockedCount += row.count || 0;
      }
    }

    // Les retraits puisent dans le solde global (dépôts + commissions) :
    // la part déjà retirée des commissions est l'estimation
    // min(commissions confirmées, retraits payés) — jamais une valeur saisie.
    const commissionsWithdrawn = Math.min(commissionsConfirmed, withdrawalsPaid);
    const commissionsAvailable = commissionsConfirmed - commissionsWithdrawn;

    // Listes réelles : transactions, retraits, audit du compte, filleuls N1
    const [txPage, wdPage, auditPage, txCount, level1] = await Promise.all([
      admin.entities.Transaction.filter({ user_id: target.id }, { sort: "-created_date", limit: 15 }),
      admin.entities.Withdrawal.filter({ user_id: target.id }, { sort: "-created_date", limit: 10 }),
      admin.entities.AuditLog.filter({ target_user_id: target.id }, { sort: "-created_date", limit: 20 }),
      admin.entities.Transaction.count({ user_id: target.id }),
      filterUsers(admin, { referred_by: target.id })
    ]);

    // Équipe réelle : niveaux 2 et 3 via referred_by (chaque utilisateur
    // compte une seule fois par niveau, structure de parrainage intacte).
    const level2 = level1.length ? await filterUsers(admin, { referred_by: { $in: level1.map((u) => u.id) } }) : [];
    const level3 = level2.length ? await filterUsers(admin, { referred_by: { $in: level2.map((u) => u.id) } }) : [];

    const transactions = (txPage.items || []).map((t) => ({
      date: t.created_date,
      kind: txKind(t),
      amount_fcfa: t.amount_fcfa,
      reference: t.reference || null,
      status: t.status,
      description: t.description || null
    }));

    const withdrawals = (wdPage.items || []).map((w) => ({
      id: w.id,
      date: w.created_date,
      amount_fcfa: w.amount_fcfa,
      payment_method: w.payment_method || null,
      reception_number: w.reception_number || null,
      status: w.status,
      reference: w.transaction_ref || null
    }));

    // Historique fusionné (dépôts, retraits, commissions, ajustements) :
    // simple lecture des enregistrements, jamais supprimé automatiquement.
    const history = [
      ...transactions,
      ...withdrawals.map((w) => ({
        ...w,
        kind: "withdrawal",
        description: [w.payment_method, w.reception_number].filter(Boolean).join(" → ") || null
      }))
    ].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 20);

    const audit = (auditPage.items || []).map((a) => ({
      action: a.action,
      admin_email: a.admin_email,
      date: a.created_date,
      reason: a.reason || null,
      details: a.details || null
    }));

    // Journal : la consultation d'une fiche est une action sensible tracée.
    waitUntil(logAdminAction(sdk, {
      action: "admin_user_sheet_view",
      admin_email: adminUser.email,
      admin_id: adminUser.id,
      target_user_id: target.id,
      details: "Consultation de la fiche utilisateur : " + (target.email || target.id)
    }));

    return Response.json({
      ok: true,
      found: true,
      user: {
        id: target.id,
        email: target.email || null,
        username: target.username || null,
        first_name: target.first_name || null,
        last_name: target.last_name || null,
        phone: target.phone || null,
        country: target.country || null,
        created_date: target.created_date || null,
        account_status: target.account_status || "active",
        blocked_reason: target.blocked_reason || null,
        blocked_at: target.blocked_at || null,
        blocked_by: target.blocked_by || null,
        referral_code: target.referral_code || null,
        referred_by: target.referred_by || null,
        access_activated: !!target.access_activated,
        access_activated_at: target.access_activated_at || null,
        initial_deposit_status: target.initial_deposit_status || "NOT_PAID",
        email_verified: !!target.email_verified,
        role: target.role || "user"
      },
      sponsor,
      finance: {
        balance,
        deposits_total: depositsTotal,
        access_fees_total: accessFeeTotal,
        commissions_confirmed: commissionsConfirmed,
        commissions_pending: commissionsPending,
        withdrawals_paid: withdrawalsPaid,
        withdrawals_reserved: withdrawalsReserved,
        transactions_count: txCount
      },
      commissions: {
        by_level: byLevel,
        earned_total: earnedTotal,
        blocked: { count: blockedCount, total: blockedTotal, by_level: blockedByLevel },
        withdrawn_estimate: commissionsWithdrawn,
        available_estimate: commissionsAvailable
      },
      team: {
        level1_count: level1.length,
        level2_count: level2.length,
        level3_count: level3.length,
        total: level1.length + level2.length + level3.length
      },
      transactions,
      withdrawals,
      history,
      audit
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}