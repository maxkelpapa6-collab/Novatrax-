import { createClientFromRequest } from "../../lib/sdk.ts";
import { ensureReferralCode, findSponsorByCode, ensureSponsorshipSync } from "../../shared/referral.ts";
import { WELCOME_BONUS_FCFA } from "../../shared/wallet.ts";

export default async function(req) {
  try {
    const body = await req.json();
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });

    const admin = sdk.asServiceRole;

    // Code personnel : créé une seule fois, jamais modifié ensuite
    const referralCode = await ensureReferralCode(admin, user);

    // Bonus de bienvenue : 500 FCFA offerts dès la création du compte,
    // réservés jusqu'à l'activation de l'accès du membre (déverrouillage
    // automatique côté serveur).
    try {
      const bonusPage = await admin.entities.Transaction.filter(
        { user_id: user.id, type: "adjustment", method: "welcome_bonus" },
        { limit: 1 }
      );
      if (((bonusPage.items) || []).length === 0) {
        await admin.entities.Transaction.create({
          type: "adjustment",
          purpose: "welcome_bonus",
          user_id: user.id,
          user_email: user.email || null,
          amount_fcfa: WELCOME_BONUS_FCFA,
          status: "pending",
          method: "welcome_bonus",
          reference: "WLB-" + user.id,
          description: "Bonus de bienvenue NOVATRAX — réservé jusqu'à l'activation de votre accès."
        });
        await admin.entities.InboxMessage.create({
          user_id: user.id,
          user_email: user.email || null,
          title: "Bienvenue sur NOVATRAX : votre bonus de " + WELCOME_BONUS_FCFA + " FCFA vous attend",
          body_text: "Bienvenue sur NOVATRAX ! Un bonus de bienvenue de " + WELCOME_BONUS_FCFA + " FCFA est réservé pour vous dès votre inscription. " +
            "Il sera crédité automatiquement à votre portefeuille dès l'activation de votre accès.",
          type: "system",
          read: false
        });
      }
    } catch (e) {
      // le bonus sera créé au prochain appel si l'écriture a échoué
    }

    // Liaison au parrain : conservée dans le registre immuable Sponsorship.
    // Une relation enregistrée ne peut être ni modifiée ni supprimée (ni par
    // le membre, ni par un tiers, ni par l'administration) — si le champ
    // referred_by a été altéré côté client, il est resynchronisé ici.
    const refCode = (body.ref_code || "").trim();

    let existing = null;
    try {
      const page = await admin.entities.Sponsorship.filter({ user_id: user.id }, { limit: 1 });
      existing = (page.items || [])[0] || null;
    } catch (e) {
      // registre indisponible : repli sur le comportement referred_by
    }

    if (existing) {
      if (existing.sponsor_id && existing.sponsor_id !== user.referred_by) {
        await admin.entities.User.update(user.id, { referred_by: existing.sponsor_id });
      }
      return Response.json({ ok: true, referral_code: referralCode, sponsor_bound: true });
    }

    // Membre enregistré avant la mise en place du registre : migration
    // de sa relation d'origine, qui devient immuable.
    if (user.referred_by) {
      await ensureSponsorshipSync(admin, user);
      return Response.json({ ok: true, referral_code: referralCode, sponsor_bound: true });
    }

    // Première attribution : lien de parrainage transmis par un autre membre
    let sponsorBound = false;
    if (refCode) {
      const sponsor = await findSponsorByCode(admin, refCode);
      // Auto-parrainage et comptes suspendus interdits
      if (sponsor && sponsor.id !== user.id && sponsor.account_status !== "suspended") {
        await admin.entities.Sponsorship.create({
          user_id: user.id,
          user_email: user.email || null,
          sponsor_id: sponsor.id,
          sponsor_email: sponsor.email || null
        });
        await admin.entities.User.update(user.id, { referred_by: sponsor.id });
        sponsorBound = true;
      }
    }

    return Response.json({ ok: true, referral_code: referralCode, sponsor_bound: sponsorBound });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}