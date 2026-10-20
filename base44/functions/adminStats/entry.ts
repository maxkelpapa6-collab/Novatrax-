import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { requireActiveAdmin, logAdminAction } from "../../shared/adminGuard.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const { user, error } = await requireActiveAdmin(base44);
    if (error) return error;

    const admin = base44.asServiceRole;
    const users = await admin.entities.User.filter({});

    const [withdrawalsPending, withdrawalsTotal, depositsConfirmed, depositsPending, campaigns] = await Promise.all([
      admin.entities.Withdrawal.count({ status: "pending" }),
      admin.entities.Withdrawal.count({}),
      admin.entities.Transaction.count({ type: "deposit", status: "confirmed" }),
      admin.entities.Transaction.count({ type: "deposit", status: "pending" }),
      admin.entities.EmailCampaign.count({})
    ]);

    await logAdminAction(base44, {
      action: "admin_space_access",
      admin_email: user.email,
      admin_id: user.id,
      result: "success",
      details: "Consultation du tableau de bord administrateur"
    });

    return Response.json({
      users_total: users.length,
      users_active: users.filter((u) => (u.account_status || "active") !== "suspended").length,
      users_blocked: users.filter((u) => u.account_status === "suspended").length,
      users_unverified: users.filter((u) => u.email_verified !== true).length,
      withdrawals_pending: withdrawalsPending,
      withdrawals_total: withdrawalsTotal,
      deposits_confirmed: depositsConfirmed,
      deposits_pending: depositsPending,
      campaigns: campaigns
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}