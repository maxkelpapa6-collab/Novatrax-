import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { WITHDRAWAL_RESERVED_STATUSES, WELCOME_BONUS_FCFA } from "../../shared/wallet.ts";
import { sendServiceEmail } from "../../shared/notify.ts";
import { ensureReferralCode, ensureSponsorshipSync } from "../../shared/referral.ts";
import { filterUsers } from "../../shared/userQuery.ts";
import { hasProAccess } from "../../shared/access.ts";

// Statistiques financières et réseau d'affiliation de l'utilisateur connecté.
// Toutes les valeurs proviennent des enregistrements réels, côté serveur uniquement.
// Appels volontairement réduits et échelonnés (quotas plateforme très stricts) :
// 3 agrégations au total, jamais en parallèle, plus un cache court du réseau
// d'affiliation (niveaux et commissions par niveau : ils ne changent qu'à
// l'inscription d'un filleul ou au versement d'une commission).
const NETWORK_CACHE_TTL_MS = 60_000;
const networkCache = new Map();

function memberSummary(u) {
  return {
    id: u.id,
    username: u.username || null,
    first_name: u.first_name || null,
    country: u.country || null,
    created_date: u.created_date || null,
    deposit_status: u.initial_deposit_status || null
  };
}

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const includeMembers = body.include_members === true;
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });

    const admin = base44.asServiceRole;

    const accessActivated = hasProAccess(user);
    const referralCode = await ensureReferralCode(admin, user);

    // Relation de parrainage d'origine conservée dans le registre immuable :
    // referred_by est resynchronisé automatiquement si le champ a été altéré.
    await ensureSponsorshipSync(admin, user);

    // 1. Dépôts confirmés par nature : portefeuille (retirable) vs frais d'accès
    const depositsByPurpose = await admin.entities.Transaction.aggregate({
      query: { user_id: user.id, type: "deposit", status: "confirmed" },
      groupBy: "purpose",
      sum: "amount_fcfa"
    });

    // 2. Commissions (ajustements) par statut : confirmées et en attente.
    // Le bonus de bienvenue (méthode welcome_bonus) est suivi à part.
    const adjustmentsByStatus = await admin.entities.Transaction.aggregate({
      query: { user_id: user.id, type: "adjustment", method: { $ne: "welcome_bonus" } },
      groupBy: "status",
      sum: "amount_fcfa"
    });

    // 3. Retraits par statut : payés et fonds réservés
    const withdrawalByStatus = await admin.entities.Withdrawal.aggregate({
      query: { user_id: user.id },
      groupBy: "status",
      sum: "amount_fcfa"
    });

    // Les frais d'accès (3 000 FCFA) paient l'entrée sur la plateforme :
    // ils ne comptent jamais comme dépôts de portefeuille retirable.
    let accessFeeTotal = 0;
    let depositsTotal = 0;
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

    let withdrawalsTotal = 0;
    let reservedTotal = 0;
    for (const row of withdrawalByStatus.rows || []) {
      const amount = row.sum_amount_fcfa || 0;
      if (row.status === "paid") withdrawalsTotal += amount;
      if (WITHDRAWAL_RESERVED_STATUSES.includes(row.status)) reservedTotal += amount;
    }

    const balance = depositsTotal + commissionsConfirmed - reservedTotal;

    // Frais d'accès en attente : lu uniquement si l'accès n'est pas encore activé
    let pendingAccess = null;
    if (!accessActivated) {
      const accessTxPage = await admin.entities.Transaction.filter(
        { user_id: user.id, type: "deposit", purpose: "access_fee" },
        { sort: "-created_date", limit: 1 }
      );
      const accessTx = (accessTxPage.items || [])[0] || null;
      if (accessTx && accessTx.status === "pending") {
        pendingAccess = { id: accessTx.id, reference: accessTx.reference, created_date: accessTx.created_date };
      }
    }

    // Règle d'accès principale : sans dépôt initial confirmé (3 000 FCFA),
    // le parrainage, le lien de parrainage et le réseau restent verrouillés.
    // Le code personnel est déjà généré en base (il servira après le dépôt),
    // mais il n'est JAMAIS transmis avant activation : aucun contournement
    // possible via l'API, et le parrain d'origine (referred_by) est conservé
    // définitivement — jamais remplacé par le propre code de l'utilisateur.
    if (!accessActivated) {
      return Response.json({
        ok: true,
        referral_code: null,
        access: {
          activated: false,
          pending: pendingAccess
        },
        stats: {
          deposits_total: depositsTotal,
          commissions_confirmed: commissionsConfirmed,
          commissions_pending: commissionsPending,
          balance: balance,
          withdrawals_total: withdrawalsTotal
        },
        welcome_bonus: {
          amount_fcfa: WELCOME_BONUS_FCFA,
          status: "pending"
        },
        network: null
      });
    }

    // 4. Réseau d'affiliation (niveaux 1 à 3, commissions par niveau) :
    // mis en cache 60 s par membre — ces données ne changent qu'à
    // l'inscription d'un filleul ou au versement d'une commission.
    let network = networkCache.get(user.id);
    if (!network || Date.now() - network.fetchedAt > NETWORK_CACHE_TTL_MS) {
      const commissionsByLevel = await admin.entities.Commission.aggregate({
        query: { beneficiary_id: user.id, status: "confirmed" },
        groupBy: "level",
        sum: "amount_fcfa"
      });
      const levelTotals = [0, 0, 0];
      for (const row of commissionsByLevel.rows || []) {
        const idx = Number(row.level) - 1;
        if (idx >= 0 && idx <= 2) levelTotals[idx] = row.sum_amount_fcfa || 0;
      }

      // Réseau réel : niveau 1 (filleuls directs), niveau 2, niveau 3
      const level1 = await filterUsers(admin, { referred_by: user.id });

      const level2 = level1.length
        ? await filterUsers(admin, { referred_by: { $in: level1.map((u) => u.id) } })
        : [];

      const level3 = level2.length
        ? await filterUsers(admin, { referred_by: { $in: level2.map((u) => u.id) } })
        : [];

      // Bonus de bienvenue (500 FCFA) : débloqué automatiquement dès que
      // l'accès du membre lui-même est activé.
      // Le crédit est garanti unique : seul un bonus encore en attente passe
      // en confirmé, une seule fois.
      const bonusPage = await admin.entities.Transaction.filter(
        { user_id: user.id, type: "adjustment", method: "welcome_bonus" },
        { limit: 1 }
      );
      const bonus = (bonusPage.items || [])[0] || null;
      let bonusStatus = bonus ? bonus.status : "pending";
      if (bonus && bonus.status === "pending" && user.access_activated) {
        await admin.entities.Transaction.updateMany(
          { id: bonus.id, status: "pending" },
          { $set: { status: "confirmed", confirmed_at: new Date().toISOString() } }
        );
        bonusStatus = "confirmed";
        try {
          await admin.entities.InboxMessage.create({
            user_id: user.id,
            user_email: user.email || null,
            title: "Bonus de bienvenue débloqué : " + WELCOME_BONUS_FCFA + " FCFA",
            body_text: "Votre accès est activé. " +
              "Votre bonus de bienvenue de " + WELCOME_BONUS_FCFA + " FCFA vient d'être crédité à votre portefeuille NOVATRAX.",
            type: "system",
            read: false
          });
        } catch (e) {
          // la notification ne doit jamais bloquer le crédit
        }
        try {
          await sendServiceEmail(
            base44,
            user.email,
            "Votre bonus de bienvenue NOVATRAX est débloqué",
            "Félicitations ! Votre bonus de bienvenue de " + WELCOME_BONUS_FCFA + " FCFA a été crédité à votre portefeuille NOVATRAX suite à l'activation de votre accès."
          );
        } catch (e) {
          // l'e-mail ne doit jamais bloquer le crédit
        }
        try {
          await admin.entities.AuditLog.create({
            action: "welcome_bonus_unlocked",
            admin_email: "system",
            target_user_id: user.id,
            details: "Bonus de bienvenue de " + WELCOME_BONUS_FCFA + " FCFA débloqué : accès du membre activé."
          });
        } catch (e) {
          // le journal ne doit jamais bloquer le crédit
        }
      }
      const bonusConfirmed = bonusStatus === "confirmed" ? ((bonus && bonus.amount_fcfa) || WELCOME_BONUS_FCFA) : 0;

      network = {
        fetchedAt: Date.now(),
        levelTotals,
        level1: level1.map(memberSummary),
        level2: level2.map(memberSummary),
        level3: level3.map(memberSummary),
        welcome_bonus: {
          amount_fcfa: bonus ? (bonus.amount_fcfa || WELCOME_BONUS_FCFA) : WELCOME_BONUS_FCFA,
          status: bonusStatus
        },
        bonus_confirmed: bonusConfirmed
      };
      if (networkCache.size > 500) networkCache.clear();
      networkCache.set(user.id, network);
    }

    return Response.json({
      ok: true,
      referral_code: referralCode,
      access: {
        activated: true,
        pending: null
      },
      stats: {
        deposits_total: depositsTotal,
        commissions_confirmed: commissionsConfirmed,
        commissions_pending: commissionsPending,
        balance: balance + (network.bonus_confirmed || 0),
        withdrawals_total: withdrawalsTotal
      },
      review: {
        flagged: user.initial_deposit_status === "REVIEW_REQUIRED"
      },
      welcome_bonus: network.welcome_bonus,
      network: {
        level1_count: network.level1.length,
        level2_count: network.level2.length,
        level3_count: network.level3.length,
        level_totals: network.levelTotals,
        counts_capped: false,
        members: includeMembers ? {
          level1: network.level1.slice(0, 100),
          level2: network.level2.slice(0, 100),
          level3: network.level3.slice(0, 100)
        } : null
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}