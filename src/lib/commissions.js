// Commissions d'affiliation par niveau, en pourcentage du prix des achats
// Marketplace effectués par le réseau (prélevées sur la commission NOVATRAX).
// Les inscriptions ne rapportent aucune commission.
export const LEVEL_COMMISSIONS = [
  { level: 1, rate: 3 },
  { level: 2, rate: 1.5 },
  { level: 3, rate: 0.5 },
];

export function formatRate(rate) {
  return String(rate).replace(".", ",") + " %";
}

export function formatFcfa(value) {
  return new Intl.NumberFormat("fr-FR").format(Number(value) || 0) + " FCFA";
}