// Accès Pro : réservé aux membres ayant confirmé réellement leur premier dépôt
// de 3 000 FCFA (frais d'accès). Les administrateurs y ont toujours accès.
export const hasProAccess = (user) => user.role === "admin" || user.access_activated === true;