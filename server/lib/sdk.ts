// Client serveur passé aux fonctions (server/functions/*/entry.ts) :
// - sdk.auth.me() : membre connecté (ou null) ;
// - sdk.asServiceRole : accès complet (entités + e-mails + fichiers privés).
import { entitiesProxy } from "./entities.ts";
import { userFromRequest } from "./auth.ts";
import { sendEmail } from "./email.ts";
import { createSignedUrl } from "./files.ts";

const integrations = {
  Core: {
    SendEmail: (params) => sendEmail(params),
    CreateFileSignedUrl: async ({ file_uri, expires_in }) => createSignedUrl(file_uri, expires_in)
  }
};

export function createClientFromRequest(req) {
  let userPromise = null;
  const me = () => {
    if (!userPromise) userPromise = userFromRequest(req.headers);
    return userPromise;
  };
  const asServiceRole = { entities: entitiesProxy({ service: true }), integrations };
  return {
    auth: { me },
    get entities() {
      throw new Error("Utilisez sdk.asServiceRole.entities dans les fonctions serveur.");
    },
    asServiceRole
  };
}
