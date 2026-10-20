import { createClientFromRequest } from "../../lib/sdk.ts";
import { MIN_WITHDRAWAL_FCFA, computeAvailableBalance } from "../../shared/wallet.ts";
import { isAllowedWithdrawalMethod } from "../../shared/withdrawalMethods.ts";

export default async function(req) {
  try {
    const body = await req.json();
    const sdk = createClientFromRequest(req);
    const user = await sdk.auth.me();
    if (!user) return Response.json({ error: "Non authentifié." }, { status: 401 });
    if (user.account_status === "suspended") {
      return Response.json({ error: "Votre compte est bloqué. Contactez le support NOVATRAX." }, { status: 403 });
    }

    const amount = Math.floor(Number(body.amount_fcfa));
    if (!amount || amount <= 0) {
      return Response.json({ error: "Montant invalide." }, { status: 400 });
    }

    const admin = sdk.asServiceRole;

    if (body.action === "deposit") {
      // Les dépôts de portefeuille passent exclusivement par le checkout LeekPay
      return Response.json({ error: "Les dépôts passent par le paiement LeekPay depuis la page Portefeuille." }, { status: 400 });
    } else if (body.action === "withdrawal") {
      if (amount < MIN_WITHDRAWAL_FCFA) {
        return Response.json({ error: "Le retrait minimum est de " + MIN_WITHDRAWAL_FCFA + " FCFA." }, { status: 400 });
      }
      if (!body.reception_number || !String(body.reception_number).trim()) {
        return Response.json({ error: "Le numéro de réception du paiement est requis." }, { status: 400 });
      }
      const country = (String(body.country || user.country || "")).trim() || null;
      const paymentMethod = (String(body.payment_method || "")).trim() || "mobile_money";
      if (!isAllowedWithdrawalMethod(country, paymentMethod)) {
        return Response.json({ error: "Ce moyen de réception n'est pas disponible dans votre pays." }, { status: 400 });
      }
      const balance = await computeAvailableBalance(admin, user.id);
      if (balance < amount) {
        return Response.json({ error: "Solde insuffisant : " + balance + " FCFA disponibles." }, { status: 409 });
      }
      const fullName = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email;
      await admin.entities.Withdrawal.create({
        user_id: user.id,
        user_email: user.email,
        user_name: fullName,
        user_phone: user.phone || null,
        amount_fcfa: amount,
        country: country,
        payment_method: paymentMethod,
        reception_number: String(body.reception_number).trim(),
        transaction_ref: crypto.randomUUID(),
        status: "pending"
      });
    } else {
      return Response.json({ error: "Action inconnue." }, { status: 400 });
    }

    const balance = await computeAvailableBalance(admin, user.id);
    return Response.json({ ok: true, balance: balance });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}