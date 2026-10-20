import { createClientFromRequest } from "../../lib/sdk.ts";
import { hasProAccess } from "../../shared/access.ts";

// Téléchargement d'un fichier APK Pro : génère une URL signée à usage unique
// pour le fichier stocké en privé. Le verrouillage (dépôt initial de 3 000 FCFA
// confirmé) est vérifié côté serveur, ainsi que la publication de l'application.
// La référence interne du stockage (apk_file_uri) n'est jamais renvoyée au client.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (user.account_status === "suspended") {
      return Response.json({ error: "Votre compte est bloqué. Contactez le support NOVATRAX." }, { status: 403 });
    }
    if (!hasProAccess(user)) {
      return Response.json({ error: "Accès réservé aux membres actifs." }, { status: 403 });
    }

    const appId = String(body.application_id || "").trim();
    if (!appId || !/^[a-f0-9]{24}$/i.test(appId)) {
      return Response.json({ error: "Application introuvable." }, { status: 404 });
    }

    const admin = sdk.asServiceRole;
    const page = await admin.entities.Application.filter({ id: appId }, { limit: 1 });
    const app = (page.items || [])[0];
    if (!app) return Response.json({ error: "Application introuvable." }, { status: 404 });
    if (app.published !== true) {
      return Response.json({ error: "Cette application n'est pas publiée." }, { status: 404 });
    }

    const type = app.download_type || (app.apk_file_uri ? "apk_file" : "external_link");
    if (type !== "apk_file" || !app.apk_file_uri) {
      return Response.json({ error: "Aucun fichier APK disponible pour cette application." }, { status: 404 });
    }

    const { signed_url } = await admin.integrations.Core.CreateFileSignedUrl({
      file_uri: app.apk_file_uri,
      expires_in: 300
    });

    return Response.json({
      ok: true,
      url: signed_url,
      file_name: app.apk_file_name || (app.name ? app.name.replace(/[^\w.-]+/g, "_") + ".apk" : "application.apk")
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}