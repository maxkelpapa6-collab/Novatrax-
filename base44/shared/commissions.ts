// Moteur d'affiliation NOVATRAX — 3 niveaux, commissions sur VENTES RÉELLES.
// Les commissions sont calculées uniquement sur les ventes Marketplace
// terminées, en pourcentage du prix de vente, et sont prélevées sur la
// commission NOVATRAX (10 %) : le vendeur touche toujours ses 90 %.
// Niveau 1 : 3 % · Niveau 2 : 1,5 % · Niveau 3 : 0,5 % du prix de vente.
// Les frais d'accès (inscription) ne génèrent JAMAIS de commission : le
// parrainage n'est rémunéré que par l'activité commerciale réelle du réseau.
// Tous les calculs sont effectués côté serveur, jamais dans le navigateur.
import { sendServiceEmail } from "./notify.ts";
import { getOriginalSponsorId } from "./referral.ts";

export const COMMISSION_RATES = { 1: 0.03, 2: 0.015, 3: 0.005 };
export const SUPPORT_EMAIL = "novatraxagencies@gmail.com";

export function commissionAmountForSale(level, priceFcfa) {
  return Math.floor((Number(priceFcfa) || 0) * (COMMISSION_RATES[level] || 0));
}

function commissionRef() {
  return "CMS-" + crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
}

async function getUserSafe(admin, id) {
  if (!id) return null;
  try {
    return await admin.entities.User.get(id);
  } catch (e) {
    return null;
  }
}

// Génère les commissions d'une vente Marketplace terminée le long de l'arbre
// de parrainage de l'ACHETEUR (referred_by, figé à l'inscription).
// Idempotent : une même vente ne produit jamais deux fois la commission d'un
// même niveau (contrôle transaction_id + niveau avant création).
export async function generateCommissionsForSale(base44, order, saleTxId) {
  const admin = base44.asServiceRole;
  const results = [];
  let current = await getUserSafe(admin, order.buyer_id);
  for (let level = 1; level <= 3; level++) {
    if (!current) break;
    const sponsorId = await getOriginalSponsorId(admin, current);
    if (!sponsorId) break;
    const sponsor = await getUserSafe(admin, sponsorId);
    if (!sponsor) break;
    current = sponsor;
    const amount = commissionAmountForSale(level, order.product_price_fcfa);
    if (amount <= 0) continue;
    // Compte du bénéficiaire bloqué : la commission est enregistrée mais
    // SUSPENDUE (statut blocked) — aucun crédit au portefeuille.
    const sponsorSuspended = sponsor.account_status === "suspended";
    const dup = await admin.entities.Commission.filter(
      { transaction_id: saleTxId, level },
      { limit: 1 }
    );
    const existing = (dup.items || [])[0] || null;
    const ref = existing ? existing.commission_ref : commissionRef();
    if (!existing) {
      await admin.entities.Commission.create({
        commission_ref: ref,
        transaction_id: saleTxId,
        transaction_reference: order.order_ref || null,
        order_id: order.id,
        beneficiary_id: sponsor.id,
        beneficiary_email: sponsor.email || null,
        source_user_id: order.buyer_id,
        source_user_email: order.buyer_email || null,
        level,
        amount_fcfa: amount,
        status: sponsorSuspended ? "blocked" : "confirmed"
      });
      if (sponsorSuspended) {
        await admin.entities.AuditLog.create({
          action: "commission_blocked_suspended",
          admin_email: "system",
          target_user_id: sponsor.id,
          target_id: saleTxId,
          details: "Commission N" + level + " (" + amount + " FCFA) suspendue : compte du bénéficiaire bloqué."
        });
      }
    }
    // Crédit du portefeuille — idempotent par référence unique : une reprise
    // après interruption ne crédite jamais deux fois.
    const creditDup = await admin.entities.Transaction.filter(
      { user_id: sponsor.id, type: "adjustment", method: "affiliate_commission", reference: ref },
      { limit: 1 }
    );
    if (!sponsorSuspended && (creditDup.items || []).length === 0) {
      await admin.entities.Transaction.create({
        type: "adjustment",
        user_id: sponsor.id,
        user_email: sponsor.email || null,
        amount_fcfa: amount,
        status: "confirmed",
        method: "affiliate_commission",
        reference: ref,
        description: "Commission affiliation niveau " + level + " (" + ref + ") — vente Marketplace " + (order.order_ref || order.id),
        confirmed_at: new Date().toISOString()
      });
      const text = "Vous avez reçu une commission d'affiliation de niveau " + level + " de " + amount +
        " FCFA (réf. " + ref + ") sur un achat Marketplace de votre réseau, créditée à votre portefeuille NOVATRAX.";
      await sendServiceEmail(base44, sponsor.email, "Vous avez reçu une commission NOVATRAX", text);
      try {
        await admin.entities.InboxMessage.create({
          user_id: sponsor.id,
          user_email: sponsor.email || null,
          title: "Nouvelle commission reçue",
          body_text: text,
          type: "commission",
          read: false
        });
      } catch (e) {
        // la notification ne doit jamais bloquer le crédit
      }
    }
    results.push({ level, beneficiary_email: sponsor.email || sponsor.id, amount_fcfa: amount });
  }
  return results;
}

// Vente remboursée : les commissions associées sont annulées et leurs crédits
// rejetés (donc retirés du solde disponible).
export async function cancelCommissionsForSale(admin, saleTxId) {
  if (!saleTxId) return;
  const page = await admin.entities.Commission.filter({ transaction_id: saleTxId }, { limit: 10 });
  for (const c of page.items || []) {
    if (c.status === "cancelled") continue;
    await admin.entities.Commission.update(c.id, { status: "cancelled" });
    const credits = await admin.entities.Transaction.filter(
      { user_id: c.beneficiary_id, type: "adjustment", method: "affiliate_commission", reference: c.commission_ref },
      { limit: 1 }
    );
    for (const t of credits.items || []) {
      await admin.entities.Transaction.update(t.id, { status: "rejected" });
    }
  }
}

// Arbre de parrainage du membre (niveaux 1 à 3), pour le dossier d'examen.
export async function buildSponsorChain(admin, user) {
  const chain = [];
  let current = user;
  let level = 1;
  while (level <= 3 && current) {
    const sponsorId = await getOriginalSponsorId(admin, current);
    if (!sponsorId) break;
    const sponsor = await getUserSafe(admin, sponsorId);
    if (!sponsor) break;
    chain.push({
      level,
      id: sponsor.id,
      email: sponsor.email || null,
      username: sponsor.username || null
    });
    current = sponsor;
    level++;
  }
  return chain;
}

// Double paiement des frais d'accès détecté : l'accès reste activé, les deux
// transactions sont conservées avec leurs références et un dossier d'examen
// est créé dans l'administration pour décider du remboursement.
export async function flagDepositAnomaly(base44, user, deposits, now) {
  const admin = base44.asServiceRole;
  const nowIso = now || new Date().toISOString();
  const first = deposits[0];
  const second = deposits[1];
  const chain = await buildSponsorChain(admin, user);
  const fullName = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;

  await admin.entities.User.update(user.id, {
    initial_deposit_status: "REVIEW_REQUIRED",
    access_activated: true,
    access_activated_at: user.access_activated_at || nowIso
  });

  // Un seul dossier ouvert par membre tant qu'il n'est pas résolu
  const existing = await admin.entities.DepositReview.filter(
    { user_id: user.id, status: "pending_review" },
    { limit: 1 }
  );
  if ((existing.items || []).length === 0) {
    await admin.entities.DepositReview.create({
      user_id: user.id,
      user_email: user.email || null,
      user_name: fullName,
      status: "pending_review",
      first_tx_id: first.id,
      first_reference: first.reference || null,
      first_amount_fcfa: first.amount_fcfa,
      first_date: first.created_date || null,
      first_confirmed_at: first.confirmed_at || null,
      second_tx_id: second.id,
      second_reference: second.reference || null,
      second_amount_fcfa: second.amount_fcfa,
      second_date: second.created_date || null,
      second_confirmed_at: second.confirmed_at || null,
      sponsor_chain: JSON.stringify(chain),
      commission_preview: "[]",
      blocked_levels: "Double paiement des frais d'accès — remboursement à examiner"
    });
  }

  await admin.entities.AuditLog.create({
    action: "access_fee_double_payment",
    admin_email: "system",
    target_user_id: user.id,
    target_id: second.id,
    details: "Double paiement des frais d'accès détecté (" + deposits.length + " dépôts non rejetés) : dossier d'examen créé. Transactions conservées."
  });

  await sendServiceEmail(
    base44,
    user.email,
    "Double paiement détecté sur votre compte NOVATRAX",
    "Nous avons reçu deux paiements de frais d'accès sur votre compte. Votre accès est bien activé. " +
    "Si vous avez payé deux fois par erreur, contactez le support NOVATRAX pour le remboursement : " + SUPPORT_EMAIL
  );
}

// Point d'entrée unique après toute confirmation réelle d'un paiement de frais
// d'accès. Active l'accès du membre — aucune commission n'est versée sur les
// frais d'accès. Un double paiement ouvre un dossier de remboursement.
export async function processAccessDepositConfirmed(base44, tx) {
  const admin = base44.asServiceRole;
  // Toujours relire la transaction : son statut vient d'être confirmé côté serveur.
  const fresh = await admin.entities.Transaction.get(tx.id).catch(() => null);
  if (!fresh || fresh.type !== "deposit" || fresh.purpose !== "access_fee" || fresh.status !== "confirmed") {
    return { processed: false };
  }
  const user = await getUserSafe(admin, fresh.user_id);
  if (!user) return { processed: false };
  const now = new Date().toISOString();

  if (user.initial_deposit_status === "REVIEW_REQUIRED") {
    return { processed: true, review: true };
  }

  // Détection du double paiement : au moins deux dépôts d'accès non rejetés.
  const page = await admin.entities.Transaction.filter(
    { user_id: user.id, type: "deposit", purpose: "access_fee", status: { $ne: "rejected" } },
    { sort: "created_date", limit: 10 }
  );
  const deposits = page.items || [];
  if (deposits.length >= 2) {
    await flagDepositAnomaly(base44, user, deposits, now);
    return { processed: true, review: true };
  }

  const alreadyConfirmed = user.initial_deposit_status === "CONFIRMED";
  await admin.entities.User.update(user.id, {
    initial_deposit_status: "CONFIRMED",
    access_activated: true,
    access_activated_at: user.access_activated_at || now
  });
  if (!alreadyConfirmed) {
    await admin.entities.AuditLog.create({
      action: "access_activated",
      admin_email: "system",
      target_user_id: user.id,
      target_id: fresh.id,
      details: "Frais d'accès confirmés : accès membre activé."
    });
  }
  return { processed: true };
}
