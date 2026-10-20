# NOVATRAX

Plateforme NOVATRAX : espace membre, réseau d'affiliation, portefeuille, Marketplace, formations, APK Pro, liens de paiement et administration.

L'application fonctionne seule, sans plateforme tierce :

- **Site web** : React + Vite + Tailwind (`src/`)
- **Serveur** : Node.js + Express (`server/`)
- **Base de données** : MongoDB
- **Paiements** : LeekPay
- **E-mails** : n'importe quel fournisseur SMTP (Gmail, Brevo, Mailjet…)

## Structure

| Dossier | Contenu |
| --- | --- |
| `src/` | Pages et composants du site |
| `src/api/client.js` | Client qui appelle le serveur |
| `server/index.ts` | Point d'entrée du serveur (API, webhooks, site) |
| `server/lib/` | Comptes, base de données, règles d'accès, e-mails, fichiers |
| `server/functions/` | Fonctions métier (portefeuille, Marketplace, admin…) |
| `server/shared/` | Logique commune (commissions, LeekPay, portefeuille…) |
| `server/entities/` | Description des données (une collection MongoDB par entité) |

## Règles de rémunération

- Les frais d'accès (3 000 FCFA) ne génèrent **aucune commission**.
- Commissions d'affiliation calculées **uniquement sur les ventes Marketplace terminées** : niveau 1 = 3 %, niveau 2 = 1,5 %, niveau 3 = 0,5 % du prix. Elles sont prises sur la commission NOVATRAX de 10 % et annulées en cas de remboursement.
- Le bonus de bienvenue (500 FCFA) est débloqué quand le membre active son propre accès.

Les taux se règlent dans `server/shared/commissions.ts`, et leur affichage dans `src/lib/commissions.js`.

## Lancer en local

Il faut **Node.js 22** et **MongoDB** (installé, ou `docker run -d -p 27017:27017 mongo:7`).

```bash
npm install
cp .env.example .env      # puis remplir JWT_SECRET (voir le fichier)
npm run dev:server        # serveur sur http://localhost:3000
npm run dev               # site sur http://localhost:5173 (dans un 2e terminal)
```

Sans SMTP configuré, les codes de vérification s'affichent dans le terminal du serveur.

## Mise en ligne

### Render (gratuit, pour tester)

1. Créez une base gratuite sur MongoDB Atlas et copiez son adresse `mongodb+srv://…`.
2. Sur Render : **New → Blueprint**, choisissez ce dépôt. Le fichier `render.yaml` configure tout ; Render demande seulement `MONGODB_URL`, `ADMIN_SETUP_CODE` et, si vous les avez, les clés LeekPay et SMTP.
3. Sans SMTP, les codes de vérification apparaissent dans l'onglet **Logs** de Render.

Version gratuite : mise en veille après 15 min sans visite, et les images envoyées sont perdues à chaque redémarrage.

### Serveur (VPS) avec Docker (recommandé pour la production)

Sur un serveur (VPS) avec Docker installé :

```bash
git clone <votre dépôt> novatrax && cd novatrax
cp .env.example .env      # remplir toutes les valeurs
docker compose up -d --build
```

Le site écoute sur le port 3000. Placez devant un reverse proxy HTTPS (Caddy, Nginx) pointant vers `localhost:3000` pour votre nom de domaine.

### Sans Docker

```bash
npm ci
npm run build
npm start                 # lit le fichier .env
```

Gardez le processus actif avec `pm2` ou `systemd`.

## Après la première mise en ligne

1. **Créer l'administrateur** : inscrivez-vous normalement sur le site, puis ouvrez `/configuration-admin` et saisissez votre e-mail et le code `ADMIN_SETUP_CODE`. Cela ne fonctionne qu'une fois.
2. **LeekPay** : renseignez `LEEKPAY_SECRET_KEY`. Les webhooks sont envoyés automatiquement à `<APP_URL>/functions/leekpayWebhook`, `/functions/marketplaceWebhook` et `/functions/paymentLinkWebhook`.
3. **Logo** : remplacez `public/logo.svg` par votre logo.

## Sauvegardes

Toutes les données sont dans MongoDB et dans le dossier des fichiers (`UPLOAD_DIR`). Sauvegardez les deux régulièrement, par exemple :

```bash
docker compose exec mongo mongodump --archive > sauvegarde-$(date +%F).archive
```
