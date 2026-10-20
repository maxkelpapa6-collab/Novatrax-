// Pays disponibles sur NOVATRAX avec indicatifs téléphoniques internationaux.
// Chaque pays liste les moyens de retrait réellement disponibles localement
// (miroir de base44/shared/withdrawalMethods.ts, validé côté serveur).
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

const GENERIC_METHODS = ["mobile_money", "bank_transfer", "other"];

export const COUNTRIES = [
  { code: "CI", name: "Côte d'Ivoire", dialCode: "+225", flag: "🇨🇮", methods: ["orange_money", "mtn_momo", "moov_money", "wave", "bank_transfer"] },
  { code: "TG", name: "Togo", dialCode: "+228", flag: "🇹🇬", methods: ["mixx_by_yas", "moov_money", "bank_transfer"] },
  { code: "BJ", name: "Bénin", dialCode: "+229", flag: "🇧🇯", methods: ["mtn_momo", "moov_money", "bank_transfer"] },
  { code: "BF", name: "Burkina Faso", dialCode: "+226", flag: "🇧🇫", methods: ["orange_money", "moov_money", "bank_transfer"] },
  { code: "CM", name: "Cameroun", dialCode: "+237", flag: "🇨🇲", methods: ["mtn_momo", "orange_money", "bank_transfer"] },
  { code: "SN", name: "Sénégal", dialCode: "+221", flag: "🇸🇳", methods: ["wave", "orange_money", "free_money", "bank_transfer"] },
  { code: "CG", name: "République du Congo", dialCode: "+242", flag: "🇨🇬", methods: ["mtn_momo", "airtel_money", "bank_transfer"] },
  { code: "CD", name: "République démocratique du Congo", dialCode: "+243", flag: "🇨🇩", methods: ["m_pesa", "orange_money", "airtel_money", "bank_transfer"] },
  { code: "ML", name: "Mali", dialCode: "+223", flag: "🇲🇱", methods: ["orange_money", "moov_money", "wave", "bank_transfer"] },
  { code: "GA", name: "Gabon", dialCode: "+241", flag: "🇬🇦", methods: ["airtel_money", "moov_money", "bank_transfer"] },
  { code: "GN", name: "Guinée-Conakry", dialCode: "+224", flag: "🇬🇳", methods: ["orange_money", "mtn_momo", "bank_transfer"] },
  { code: "GW", name: "Guinée-Bissau", dialCode: "+245", flag: "🇬🇼", methods: ["orange_money", "mtn_momo", "bank_transfer"] },
  { code: "NE", name: "Niger", dialCode: "+227", flag: "🇳🇪", methods: ["airtel_money", "moov_money", "bank_transfer"] },
  { code: "TD", name: "Tchad", dialCode: "+235", flag: "🇹🇩", methods: ["airtel_money", "moov_money", "bank_transfer"] },
  { code: "CF", name: "Centrafrique", dialCode: "+236", flag: "🇨🇫", methods: ["orange_money", "moov_money", "bank_transfer"] },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭", methods: ["mtn_momo", "airtel_money", "bank_transfer"] },
  { code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪", methods: ["m_pesa", "airtel_money", "bank_transfer"] },
];

export const COUNTRY_BY_CODE = COUNTRIES.reduce((acc, c) => {
  acc[c.code] = c;
  return acc;
}, {});

export function getCountry(code) {
  return COUNTRY_BY_CODE[code] || null;
}

// Moyens de réception proposés pour un pays : opérateurs locaux + virement
// bancaire. Pays inconnu : liste générique (Mobile Money, virement, autre).
export function getWithdrawalMethods(code) {
  const list = (code && COUNTRY_BY_CODE[code] && COUNTRY_BY_CODE[code].methods) || GENERIC_METHODS;
  return list.map((value) => ({ value, label: WITHDRAWAL_METHOD_LABELS[value] || value }));
}