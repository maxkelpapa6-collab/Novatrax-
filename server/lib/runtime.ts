// Utilitaires d'exécution des fonctions serveur : secrets (variables
// d'environnement), tâches de fond et URL publique du site.

export const secrets = {
  get(name) {
    return (process.env[name] || "").trim();
  }
};

// Lance une tâche sans bloquer la réponse ; une erreur est journalisée.
export function waitUntil(promise) {
  Promise.resolve(promise).catch((e) => console.error("[waitUntil]", e));
}

// URL publique du site (retours de paiement, webhooks, liens des e-mails).
// Sur Render, l'adresse du service est fournie automatiquement.
export function appUrl() {
  return (process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "").replace(/\/+$/, "");
}
