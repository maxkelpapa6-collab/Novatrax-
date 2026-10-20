import { createClientFromRequest } from "../../lib/sdk.ts";
import { requireActiveAdmin, logAdminAction } from "../../shared/adminGuard.ts";
import { emailShell, textToHtml, htmlToText } from "../../shared/emailBranding.ts";

const MAX_RECIPIENTS = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FOOTER_TEXT = "\n\n—\nNOVATRAX\nUne question ? Contactez-nous : novatraxagencies@gmail.com\nVous recevez ce message car vous êtes inscrit sur NOVATRAX. Pour ne plus recevoir ces communications, désactivez-les depuis votre profil.";
const FOOTER_HTML = '<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">NOVATRAX — Une question ? Contactez-nous : <a href="mailto:novatraxagencies@gmail.com" style="color:#2563eb">novatraxagencies@gmail.com</a><br>Vous recevez ce message car vous êtes inscrit sur NOVATRAX. Pour ne plus recevoir ces communications, désactivez-les depuis votre profil.</div>';

async function resolveRecipients(admin, audience) {
  const type = (audience && audience.type) || "all";
  const query = {};
  if (type === "country" && audience.country) query.country = audience.country;
  if (type === "active") query.account_status = "active";
  if (type === "period" && audience.date_from) {
    query.created_date = { $gte: audience.date_from, $lte: (audience.date_to || audience.date_from) + "T23:59:59" };
  }
  const res = await admin.entities.User.filter(query);
  const list = Array.isArray(res) ? res : res.items || [];
  return list.filter((u) =>
    u.email && EMAIL_RE.test(u.email) &&
    u.unsubscribed !== true &&
    u.account_status !== "suspended" &&
    u.email_verified !== false
  );
}

export default async function(req) {
  try {
    const body = await req.json();
    const action = body.action;
    const sdk = createClientFromRequest(req);
    const { user, error } = await requireActiveAdmin(sdk);
    if (error) return error;

    const admin = sdk.asServiceRole;
    const subject = (body.subject || "").trim();
    const bodyText = (body.body_text || "").trim() || null;
    const bodyHtml = (body.body_html || "").trim() || null;
    const audience = body.audience || { type: "all" };

    if (action === "count") {
      const recipients = await resolveRecipients(admin, audience);
      return Response.json({ count: recipients.length });
    }

    if (action === "test") {
      if (!subject || (!bodyText && !bodyHtml)) {
        return Response.json({ error: "L'objet et le contenu du message sont requis." }, { status: 400 });
      }
      const contentHtml = bodyHtml || (bodyText ? textToHtml(bodyText) : null);
      await admin.integrations.Core.SendEmail({
        to: user.email,
        subject: "[TEST NOVATRAX] " + subject,
        html: contentHtml ? emailShell(contentHtml, { title: subject }) : undefined,
        text: bodyText ? bodyText + FOOTER_TEXT : undefined,
        from_name: "NOVATRAX"
      });
      await logAdminAction(sdk, {
        action: "email_test_send",
        admin_email: user.email,
        admin_id: user.id,
        reason: subject
      });
      return Response.json({ ok: true, sent_to: user.email });
    }

    if (action === "send") {
      if (body.confirm !== true) {
        return Response.json({ error: "Confirmation obligatoire avant l'envoi collectif." }, { status: 400 });
      }
      if (!subject || (!bodyText && !bodyHtml)) {
        return Response.json({ error: "L'objet et le contenu du message sont requis." }, { status: 400 });
      }

      const recent = await admin.entities.EmailCampaign.filter(
        { subject: subject, sent_by_email: user.email },
        { sort: "-created_date", limit: 3 }
      );
      const dup = (recent.items || []).find((c) =>
        c.created_date && (Date.now() - new Date(c.created_date).getTime()) < 10 * 60 * 1000
      );
      if (dup) {
        return Response.json({ error: "Une campagne identique a déjà été envoyée il y a moins de 10 minutes." }, { status: 409 });
      }

      const recipients = await resolveRecipients(admin, audience);
      if (recipients.length === 0) {
        return Response.json({ error: "Aucun destinataire éligible pour cette audience." }, { status: 400 });
      }
      const capped = recipients.slice(0, MAX_RECIPIENTS);

      const campaign = await admin.entities.EmailCampaign.create({
        subject: subject,
        body_html: bodyHtml,
        body_text: bodyText,
        audience_type: audience.type || "all",
        audience_details: JSON.stringify(audience),
        recipients_count: capped.length,
        sent_count: 0,
        failed_count: 0,
        status: "sending",
        sent_by: user.id,
        sent_by_email: user.email
      });

      const htmlFinal = emailShell(bodyHtml || textToHtml(bodyText), { title: subject });
      const textFinal = bodyText || (bodyHtml ? htmlToText(bodyHtml) : "");
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < capped.length; i += 6) {
        const chunk = capped.slice(i, i + 6);
        const results = await Promise.allSettled(chunk.map((u) =>
          admin.integrations.Core.SendEmail({
            to: u.email,
            subject: subject,
            html: htmlFinal,
            text: textFinal ? textFinal + FOOTER_TEXT : undefined,
            from_name: "NOVATRAX"
          })
        ));
        const logs = results.map((r, idx) => ({
          campaign_id: campaign.id,
          recipient_email: chunk[idx].email,
          recipient_user_id: chunk[idx].id,
          status: r.status === "fulfilled" ? "sent" : "failed",
          error: r.status === "rejected" ? String(r.reason && r.reason.message || r.reason) : null
        }));
        if (logs.length) await admin.entities.EmailDeliveryLog.bulkCreate(logs);
        sentCount += logs.filter((l) => l.status === "sent").length;
        failedCount += logs.filter((l) => l.status === "failed").length;
      }

      const status = failedCount === 0 ? "sent" : (sentCount === 0 ? "failed" : "partial");
      await admin.entities.EmailCampaign.update(campaign.id, {
        status: status,
        sent_count: sentCount,
        failed_count: failedCount
      });
      // Notification dans la boîte de réception de chaque destinataire
      const inboxBody = bodyText || (bodyHtml ? htmlToText(bodyHtml) : "");
      const inboxRecords = capped.map((u) => ({
        user_id: u.id,
        user_email: u.email,
        title: subject,
        body_text: inboxBody,
        campaign_id: campaign.id,
        type: "admin_message",
        read: false
      }));
      for (let i = 0; i < inboxRecords.length; i += 500) {
        await admin.entities.InboxMessage.bulkCreate(inboxRecords.slice(i, i + 500));
      }
      await logAdminAction(sdk, {
        action: "email_campaign_send",
        admin_email: user.email,
        admin_id: user.id,
        reason: subject,
        details: "Campagne " + campaign.id + " : " + sentCount + " envoyés, " + failedCount + " échecs, " + capped.length + " destinataires"
      });
      return Response.json({
        ok: true,
        campaign_id: campaign.id,
        inbox_count: capped.length,
        recipients: capped.length,
        sent_count: sentCount,
        failed_count: failedCount,
        status: status
      });
    }

    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}