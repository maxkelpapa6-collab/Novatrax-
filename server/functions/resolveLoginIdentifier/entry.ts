import { createClientFromRequest } from "../../lib/sdk.ts";

export default async function(req) {
  try {
    const body = await req.json();
    const identifier = (body.identifier || "").trim();
    if (!identifier || identifier.length < 3) {
      return Response.json({ error: "Identifiant invalide." }, { status: 400 });
    }
    if (identifier.includes("@")) {
      return Response.json({ email: identifier.toLowerCase() });
    }
    const sdk = createClientFromRequest(req);
    const admin = sdk.asServiceRole;
    const found = await admin.entities.User.filter(
      { username: identifier.toLowerCase() }
    );
    const u = found.items && found.items[0];
    if (!u || !u.email) {
      return Response.json({ email: null });
    }
    return Response.json({ email: u.email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}