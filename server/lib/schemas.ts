// Schémas des entités (server/entities/*.jsonc) : utilisés pour connaître
// les entités existantes et appliquer les valeurs par défaut à la création.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ENTITIES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "entities");

function stripJsonComments(text) {
  return text.replace(/^\s*\/\/.*$/gm, "");
}

export const schemas = {};
for (const file of readdirSync(ENTITIES_DIR)) {
  if (!file.endsWith(".jsonc") && !file.endsWith(".json")) continue;
  const schema = JSON.parse(stripJsonComments(readFileSync(join(ENTITIES_DIR, file), "utf8")));
  schemas[schema.name] = schema;
}

export function applyDefaults(name, data) {
  const props = schemas[name]?.properties || {};
  const out = { ...data };
  for (const [key, def] of Object.entries(props)) {
    if (out[key] === undefined && def && def.default !== undefined) out[key] = def.default;
  }
  return out;
}
