// Génération et résolution des codes de parrainage — partagé entre les fonctions serveur.
export function makeReferralCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "NX";
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// Chaque utilisateur possède un code unique, généré une seule fois puis conservé définitivement.
// `user` provient de sdk.auth.me() : il porte déjà les champs personnalisés (referral_code, referred_by).
export async function ensureReferralCode(admin, user) {
  if (user.referral_code) return user.referral_code;
  const code = makeReferralCode();
  await admin.entities.User.update(user.id, { referral_code: code });
  return code;
}

// Parrain d'origine d'un membre : la relation est conservée dans le registre
// immuable Sponsorship (aucune modification ni suppression possible). Le champ
// referred_by ne sert que de repli pour les comptes antérieurs non migrés.
export async function getOriginalSponsorId(admin, user) {
  if (!user || !user.id) return (user && user.referred_by) || null;
  try {
    const page = await admin.entities.Sponsorship.filter({ user_id: user.id }, { limit: 1 });
    const record = (page.items || [])[0] || null;
    if (record && record.sponsor_id) return record.sponsor_id;
  } catch (e) {
    // registre indisponible : repli sur referred_by
  }
  return user.referred_by || null;
}

// Cohérence du parrainage : resynchronise referred_by depuis le registre
// immuable si le champ a été altéré côté client, et migre les membres
// enregistrés avant la mise en place du registre. Personne ne peut ainsi
// détacher un filleul de son parrain d'origine.
export async function ensureSponsorshipSync(admin, user) {
  if (!user || !user.id) return user;
  let record = null;
  try {
    const page = await admin.entities.Sponsorship.filter({ user_id: user.id }, { limit: 1 });
    record = (page.items || [])[0] || null;
  } catch (e) {
    return user;
  }
  if (record) {
    if (record.sponsor_id && record.sponsor_id !== user.referred_by) {
      try {
        await admin.entities.User.update(user.id, { referred_by: record.sponsor_id });
      } catch (e) {
        // la resynchronisation sera retentée au prochain appel
      }
      return { ...user, referred_by: record.sponsor_id };
    }
    return user;
  }
  // Membre antérieur au registre : migration de sa relation d'origine
  if (user.referred_by) {
    try {
      const sponsor = await admin.entities.User.get(user.referred_by).catch(() => null);
      await admin.entities.Sponsorship.create({
        user_id: user.id,
        user_email: user.email || null,
        sponsor_id: user.referred_by,
        sponsor_email: (sponsor && sponsor.email) || null
      });
    } catch (e) {
      // migration retentée au prochain appel
    }
  }
  return user;
}

// Recherche d'un parrain par code de parrainage ou nom d'utilisateur.
export async function findSponsorByCode(admin, refCode) {
  const code = (refCode || "").trim().toLowerCase();
  if (!code) return null;
  const found = await admin.entities.User.filter(
    { $or: [{ referral_code: code.toUpperCase() }, { username: code }] }
  );
  const list = Array.isArray(found) ? found : (found.items || []);
  return list[0] || null;
}