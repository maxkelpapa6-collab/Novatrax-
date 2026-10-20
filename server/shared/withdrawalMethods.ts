// Moyens de retrait disponibles par pays — source de vérité côté serveur
// (miroir d'affichage dans src/lib/countries.js pour le formulaire membre).
export const WITHDRAWAL_METHOD_LABELS = {
  mobile_money: "Mobile Money",
  bank_transfer: "Virement bancaire",
  other: "Autre",
  orange_money: "Orange Money",
  mtn_momo: "MTN MoMo",
  moov_money: "Moov Money",
  wave: "Wave",
  mixx_by_yas: "Mixx by Yas (Togocom)",
  free_money: "Free Money",
  airtel_money: "Airtel Money",
  m_pesa: "M-Pesa",
};

const METHODS_BY_COUNTRY = {
  CI: ["orange_money", "mtn_momo", "moov_money", "wave", "bank_transfer"],
  TG: ["mixx_by_yas", "moov_money", "bank_transfer"],
  BJ: ["mtn_momo", "moov_money", "bank_transfer"],
  BF: ["orange_money", "moov_money", "bank_transfer"],
  CM: ["mtn_momo", "orange_money", "bank_transfer"],
  SN: ["wave", "orange_money", "free_money", "bank_transfer"],
  CG: ["mtn_momo", "airtel_money", "bank_transfer"],
  CD: ["m_pesa", "orange_money", "airtel_money", "bank_transfer"],
  ML: ["orange_money", "moov_money", "wave", "bank_transfer"],
  GA: ["airtel_money", "moov_money", "bank_transfer"],
  GN: ["orange_money", "mtn_momo", "bank_transfer"],
  GW: ["orange_money", "mtn_momo", "bank_transfer"],
  NE: ["airtel_money", "moov_money", "bank_transfer"],
  TD: ["airtel_money", "moov_money", "bank_transfer"],
  CF: ["orange_money", "moov_money", "bank_transfer"],
  GH: ["mtn_momo", "airtel_money", "bank_transfer"],
  KE: ["m_pesa", "airtel_money", "bank_transfer"],
};

// Pays inconnu / non renseigné : liste générique uniquement.
const GENERIC_METHODS = ["mobile_money", "bank_transfer", "other"];

export function getWithdrawalMethods(country) {
  return (country && METHODS_BY_COUNTRY[country]) || GENERIC_METHODS;
}

export function isAllowedWithdrawalMethod(country, method) {
  return getWithdrawalMethods(country).includes(method);
}