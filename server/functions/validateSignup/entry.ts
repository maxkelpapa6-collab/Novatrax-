import { createClientFromRequest } from "../../lib/sdk.ts";
import { findSponsorByCode } from "../../shared/referral.ts";

// Nom complet affich\u00e9 au filleul sur le lien de parrainage (\u00ab Invit\u00e9e par \u00bb)
function displayName(s) {
  const name = [s.first_name, s.last_name].filter(Boolean).join(" ").trim();
  return name || s.full_name || s.username || null;
}

export default async function(req) {
  try {
    const body = await req.json();
    const username = (body.username || "").trim().toLowerCase();
    const refCode = (body.ref_code || "").trim();
    const sdk = createClientFromRequest(req);
    const admin = sdk.asServiceRole;

    // Résolution du parrain seule (avant l'inscription, pour afficher « Invitée par »)
    if (!username && refCode) {
      const s = await findSponsorByCode(admin, refCode);
      if (!s || s.account_status === "suspended") {
        return Response.json({ sponsor: null });
      }
      return Response.json({ sponsor: { username: s.username || null, name: displayName(s), id: s.id } });
    }

    if (!username || username.length > 60) {
      return Response.json({ error: "Nom d'utilisateur requis." }, { status: 400 });
    }
    if (!/^[a-z0-9_.]{3,20}$/.test(username)) {
      return Response.json({ error: "Nom d'utilisateur invalide : 3 à 20 caractères (lettres, chiffres, _ ou .)." }, { status: 400 });
    }

    const taken = await admin.entities.User.filter({ username });
    const usernameAvailable = !(taken.items && taken.items.length > 0);

    let sponsor = null;
    if (refCode) {
      const s = await findSponsorByCode(admin, refCode);
      if (s && s.account_status !== "suspended") {
        sponsor = { username: s.username || null, name: displayName(s), id: s.id };
      }
    }

    return Response.json({ username_available: usernameAvailable, sponsor });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}