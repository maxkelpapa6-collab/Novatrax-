import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { hasProAccess } from "../../shared/access.ts";

// Contenus réservés aux membres actifs : formations et applications APK Pro.
// Le verrouillage est vérifié côté serveur : sans dépôt d'accès confirmé,
// aucune donnée n'est renvoyée (locked: true), quel que soit l'écran appelant.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (user.account_status === "suspended") {
      return Response.json({ error: "Votre compte est bloqué. Contactez le support NOVATRAX." }, { status: 403 });
    }
    const admin = base44.asServiceRole;
    const isAdmin = user.role === "admin";
    const [formationsPage, applicationsPage] = await Promise.all([
      admin.entities.Formation.filter({}, { sort: "-created_date", limit: 100 }),
      admin.entities.Application.filter({}, { sort: "-created_date", limit: 100 })
    ]);

    // Vitrine (photos de profil uniquement, sans contenu ni liens) : visible par
    // tous les membres actifs, même sans accès Pro — contenu complet réservé.
    const showcase = [
      ...(applicationsPage.items || []).filter((a) => a.published === true).slice(0, 4)
        .map((a) => ({ id: a.id, kind: "app", name: a.name, image: a.logo_image || null })),
      ...(formationsPage.items || []).filter((f) => f.published === true).slice(0, 2)
        .map((f) => ({ id: f.id, kind: "formation", name: f.title, image: f.profile_image || f.cover_image || null })),
    ];

    if (!hasProAccess(user)) {
      return Response.json({ locked: true, showcase });
    }

    // Les membres non administrateurs ne reçoivent ni le contenu ni les liens des
    // éléments non publiés : ils apparaissent uniquement comme « En préparation ».
    const formations = (formationsPage.items || []).map((f) => {
      if (isAdmin || f.published === true) return f;
      return { id: f.id, title: f.title, description: f.description, cover_image: f.cover_image || null, profile_image: f.profile_image || null, published: false };
    });
    // Les membres ne reçoivent jamais la référence interne du fichier APK
    // (apk_file_uri) : le téléchargement passe par la fonction protégée apkDownload.
    const applications = (applicationsPage.items || []).map((a) => {
      if (isAdmin) return a;
      const type = a.download_type || (a.apk_file_uri ? "apk_file" : "external_link");
      if (a.published !== true) {
        return { id: a.id, name: a.name, description: a.description, logo_image: a.logo_image || null, price: a.price || null, published: false };
      }
      return {
        id: a.id,
        name: a.name,
        description: a.description,
        logo_image: a.logo_image || null,
        price: a.price || null,
        features: a.features || null,
        version: a.version || null,
        purchase_url: a.purchase_url || null,
        published: true,
        download_type: type,
        download_url: type === "external_link" ? (a.download_url || null) : null,
        has_apk_file: type === "apk_file" && !!a.apk_file_uri,
        apk_file_name: type === "apk_file" ? (a.apk_file_name || null) : null
      };
    });

    return Response.json({ locked: false, showcase, formations, applications });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}