import { createClientFromRequest } from "../../lib/sdk.ts";
import { hasProAccess } from "../../shared/access.ts";
import { filterUsers } from "../../shared/userQuery.ts";
import {
  eligibleContactMember, resolveRangeQuery, countByRanges, dedupeById,
  contactDisplayName, normalizePhone, buildVcf, buildContactsCsv,
} from "../../shared/contacts.ts";

// Répertoire de contacts NOVATRAX — fichiers générés à la demande, côté serveur.
// - Accès réservé aux membres ayant activé leur accès (dépôt de 3 000 FCFA
//   réellement confirmé) ou aux administrateurs. Jamais déduit d'un simple
//   retour de la page de paiement.
// - Seuls les membres ayant explicitement consenti (share_contacts) et
//   renseigné un numéro au format international apparaissent dans les fichiers.
// - Aucune URL publique permanente : le contenu est reconstruit à chaque demande
//   et chaque téléchargement est journalisé.
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function directoryQuery(body) {
  const query = { share_contacts: true };
  const range = resolveRangeQuery(body.range, body.date_from, body.date_to);
  if (range.created_date) query.created_date = range.created_date;
  const search = String(body.search || "").trim();
  if (search) {
    const rx = { $regex: escapeRegex(search), $options: "i" };
    query.$or = [{ username: rx }, { first_name: rx }, { last_name: rx }, { phone: rx }];
  }
  return query;
}

export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (!hasProAccess(user)) {
      return Response.json({ error: "Réservé aux membres ayant activé leur accès NOVATRAX." }, { status: 403 });
    }
    const admin = sdk.asServiceRole;
    const action = body.action || "summary";

    if (action === "summary") {
      const members = dedupeById(await filterUsers(admin, { share_contacts: true })).filter(eligibleContactMember);
      return Response.json({
        ok: true,
        consent: user.share_contacts === true,
        counts: countByRanges(members),
      });
    }

    if (action === "directory") {
      const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 200);
      const members = dedupeById(await filterUsers(admin, directoryQuery(body))).filter(eligibleContactMember);
      const items = members.slice(0, limit).map((m) => ({
        id: m.id,
        name: contactDisplayName(m),
        phone: normalizePhone(m.phone),
        country: m.country || null,
        created_date: m.created_date || null,
      }));
      return Response.json({
        ok: true,
        count: members.length,
        items,
        truncated: members.length > items.length,
      });
    }

    if (action === "download") {
      const members = dedupeById(await filterUsers(admin, directoryQuery(body))).filter(eligibleContactMember);
      if (!members.length) {
        return Response.json({ error: "Aucun contact disponible pour cette sélection." }, { status: 404 });
      }
      const format = body.format === "csv" ? "csv" : "vcf";
      const content = format === "csv" ? buildContactsCsv(members) : buildVcf(members);
      const filename = format === "csv" ? "NOVATRAX_CONTACTS.csv" : "NOVATRAX_CONTACTS.vcf";
      await admin.entities.AuditLog.create({
        action: "member_directory_download",
        admin_email: user.email || "membre",
        details: members.length + " contact(s) consentant(s) exporté(s) — période : " + (body.range || "all") + ", format : " + format,
      });
      return Response.json({ ok: true, count: members.length, content, filename });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}