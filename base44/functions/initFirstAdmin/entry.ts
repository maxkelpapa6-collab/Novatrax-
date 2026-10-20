import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { secrets } from 'base44:runtime';

export default async function(req) {
  try {
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const setupCode = (body.setup_code || "").trim();
    const expectedCode = secrets.get("ADMIN_SETUP_CODE");

    const base44 = createClientFromRequest(req);
    const admin = base44.asServiceRole;

    if (!expectedCode) {
      return Response.json(
        { error: "Code de configuration initiale non défini. Définissez la variable ADMIN_SETUP_CODE dans les paramètres de l'application." },
        { status: 500 }
      );
    }
    if (!email || !setupCode) {
      return Response.json({ error: "L'adresse e-mail et le code de configuration sont requis." }, { status: 400 });
    }

    if (setupCode !== expectedCode) {
      await admin.entities.AuditLog.create({
        action: "admin_init_failed",
        admin_email: email,
        result: "error",
        reason: "Code de configuration incorrect"
      });
      return Response.json({ error: "Code de configuration incorrect." }, { status: 403 });
    }

    const existingAdmins = await admin.entities.User.filter({ role: "admin" });
    if (existingAdmins.items && existingAdmins.items.length > 0) {
      return Response.json({ error: "Un administrateur principal est déjà configuré. Aucun nouvel inscrit ne peut recevoir les droits d'administration." }, { status: 409 });
    }

    const found = await admin.entities.User.filter({ email });
    const target = found.items && found.items[0];
    if (!target) {
      return Response.json({ error: "Aucun compte inscrit avec cette adresse e-mail. Créez d'abord votre compte via le lien d'inscription." }, { status: 404 });
    }

    await admin.entities.User.update(target.id, { role: "admin" });
    await admin.entities.AuditLog.create({
      action: "admin_init",
      admin_email: email,
      admin_id: target.id,
      target_user_id: target.id,
      result: "success",
      details: "Administrateur principal créé lors de la configuration initiale"
    });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}