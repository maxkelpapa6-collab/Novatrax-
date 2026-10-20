export async function requireActiveAdmin(base44) {
  const user = await base44.auth.me();
  if (!user) {
    return { user: null, error: Response.json({ error: "Non authentifié." }, { status: 401 }) };
  }
  if (user.role !== "admin") {
    return { user: null, error: Response.json({ error: "Accès réservé aux administrateurs." }, { status: 403 }) };
  }
  if (user.account_status === "suspended") {
    return { user: null, error: Response.json({ error: "Votre compte administrateur est bloqué." }, { status: 403 }) };
  }
  return { user, error: null };
}

export async function logAdminAction(base44, entry) {
  await base44.asServiceRole.entities.AuditLog.create({
    action: entry.action,
    admin_email: entry.admin_email,
    admin_id: entry.admin_id || null,
    target_user_id: entry.target_user_id || null,
    target_id: entry.target_id || null,
    result: entry.result || "success",
    reason: entry.reason || null,
    details: entry.details || null
  });
}