// Serveur NOVATRAX : API (comptes, données, fonctions métier, fichiers),
// webhooks de paiement et site web (dossier dist/ produit par `npm run build`).
import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { connectDb, closeDb } from "./lib/db.ts";
import { entityStore, ensureIndexes, HttpError } from "./lib/entities.ts";
import { authRouter, userFromRequest } from "./lib/auth.ts";
import { savePublicFile, savePrivateFile, verifySignedPath, PUBLIC_FILES_DIR } from "./lib/files.ts";

const ROOT = dirname(fileURLToPath(import.meta.url));
const FUNCTIONS_DIR = join(ROOT, "functions");
const DIST_DIR = resolve(ROOT, "..", "dist");
const FUNCTION_NAMES = new Set(readdirSync(FUNCTIONS_DIR).filter((n) => existsSync(join(FUNCTIONS_DIR, n, "entry.ts"))));

// Gestionnaire d'erreurs commun des routes asynchrones.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

async function memberCtx(req) {
  return { user: await userFromRequest(req.headers), service: false };
}

// ---------- Fonctions métier (server/functions/<nom>/entry.ts) ----------
const handlers = new Map();
async function loadHandler(name) {
  if (!handlers.has(name)) {
    const mod = await import(pathToFileURL(join(FUNCTIONS_DIR, name, "entry.ts")).href);
    handlers.set(name, mod.default);
  }
  return handlers.get(name);
}

async function runFunction(req, res) {
  const name = req.params.name;
  if (!FUNCTION_NAMES.has(name)) return res.status(404).json({ error: "Fonction inconnue." });
  const handler = await loadHandler(name);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  const url = req.protocol + "://" + req.get("host") + req.originalUrl;
  const hasBody = !["GET", "HEAD"].includes(req.method);
  const body = hasBody ? (Buffer.isBuffer(req.body) && req.body.length ? req.body : "{}") : undefined;
  const response = await handler(new Request(url, { method: req.method, headers, body }));
  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "content-length") res.setHeader(key, value);
  });
  res.send(Buffer.from(await response.arrayBuffer()));
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  const rawBody = express.raw({ type: () => true, limit: "2mb" });
  const json = express.json({ limit: "2mb" });

  // Webhooks de paiement (URL fournie au prestataire : <APP_URL>/functions/<nom>)
  app.all("/functions/:name", rawBody, wrap(runFunction));
  // Code de configuration admin : nombre d'essais limité.
  app.post("/api/functions/initFirstAdmin", rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false }));
  app.post("/api/functions/:name", rawBody, wrap(runFunction));

  // Comptes
  app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }), json, authRouter());

  // Données (accès filtré par les règles de server/lib/rls.ts)
  const ent = express.Router();
  ent.use(json);
  ent.post("/:entity/filter", wrap(async (req, res) => {
    res.json(await entityStore(req.params.entity, await memberCtx(req)).filter(req.body?.query || {}, req.body?.options || {}));
  }));
  ent.post("/:entity/count", wrap(async (req, res) => {
    res.json({ count: await entityStore(req.params.entity, await memberCtx(req)).count(req.body?.query || {}) });
  }));
  ent.post("/:entity/aggregate", wrap(async (req, res) => {
    res.json(await entityStore(req.params.entity, await memberCtx(req)).aggregate(req.body || {}));
  }));
  ent.post("/:entity/updateMany", wrap(async (req, res) => {
    res.json(await entityStore(req.params.entity, await memberCtx(req)).updateMany(req.body?.query || {}, req.body?.update || {}));
  }));
  ent.get("/:entity/:id", wrap(async (req, res) => {
    res.json(await entityStore(req.params.entity, await memberCtx(req)).get(req.params.id));
  }));
  ent.post("/:entity", wrap(async (req, res) => {
    res.json(await entityStore(req.params.entity, await memberCtx(req)).create(req.body || {}));
  }));
  ent.patch("/:entity/:id", wrap(async (req, res) => {
    res.json(await entityStore(req.params.entity, await memberCtx(req)).update(req.params.id, req.body || {}));
  }));
  ent.delete("/:entity/:id", wrap(async (req, res) => {
    res.json(await entityStore(req.params.entity, await memberCtx(req)).delete(req.params.id));
  }));
  app.use("/api/entities", ent);

  // Fichiers
  const uploadPublic = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
  const uploadPrivate = multer({ storage: multer.memoryStorage(), limits: { fileSize: 300 * 1024 * 1024 } });
  app.post("/api/files/public", wrap(async (req, res, next) => {
    const user = await userFromRequest(req.headers);
    if (!user) return res.status(401).json({ error: "Non authentifié." });
    if (user.account_status === "suspended") return res.status(403).json({ error: "Compte bloqué." });
    uploadPublic.single("file")(req, res, async (err) => {
      if (err) return next(new HttpError(400, err.message));
      if (!req.file) return next(new HttpError(400, "Fichier manquant."));
      try {
        res.json(await savePublicFile(req.file.buffer, req.file.originalname));
      } catch (e) {
        next(new HttpError(400, e.message));
      }
    });
  }));
  app.post("/api/files/private", wrap(async (req, res, next) => {
    const user = await userFromRequest(req.headers);
    if (!user || user.role !== "admin") return res.status(403).json({ error: "Accès réservé aux administrateurs." });
    uploadPrivate.single("file")(req, res, async (err) => {
      if (err) return next(new HttpError(400, err.message));
      if (!req.file) return next(new HttpError(400, "Fichier manquant."));
      try {
        res.json(await savePrivateFile(req.file.buffer, req.file.originalname));
      } catch (e) {
        next(new HttpError(400, e.message));
      }
    });
  }));
  app.use("/files", (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "default-src 'none'");
    next();
  });
  app.use("/files/public", express.static(PUBLIC_FILES_DIR, { maxAge: "30d", index: false, dotfiles: "deny" }));
  app.get("/files/private/:name", (req, res) => {
    const path = verifySignedPath(req.params.name, req.query.exp, req.query.sig);
    if (!path) return res.status(403).send("Lien expiré ou invalide.");
    res.download(path);
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api", (_req, res) => res.status(404).json({ error: "Route inconnue." }));

  // Site web
  if (existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR, { index: false, maxAge: "1h" }));
    app.get(/.*/, (_req, res) => res.sendFile(join(DIST_DIR, "index.html")));
  }

  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 && process.env.NODE_ENV === "production" ? "Erreur serveur." : err.message });
  });
  return app;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  await connectDb();
  await ensureIndexes();
  const port = Number(process.env.PORT || 3000);
  const server = createApp().listen(port, () => console.log("NOVATRAX en ligne sur le port " + port));
  const stop = async () => {
    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
