# Contribuer

🇬🇧 [English version](./CONTRIBUTING.en.md)

Merci de ton intérêt pour ce projet. QcWeather est une application de prévisions météo (API Express/TypeScript + PWA Svelte 5) ; toute contribution qui corrige un bug, améliore l'accessibilité ou la résilience, ou complète la documentation est bienvenue.

## Avant de commencer

- Ouvrir une issue pour discuter du changement envisagé, sauf correction triviale (typo, lien cassé).
- Vérifier que le changement n'est pas déjà en cours dans la section `[Non publié]` de [`CHANGELOG.md`](./CHANGELOG.md).

## Environnement de développement

```bash
git clone git@github.com:Alithiel31/WeatherQC.git
cd WeatherQC

cd backend
npm install
cp .env.example .env
# éditer .env si nécessaire (IP Tailscale, origines publiques...)

cd ../frontend
npm install
```

Lancer les deux en parallèle (deux terminaux) :

```bash
cd backend && npm run dev    # http://localhost:3005
cd frontend && npm run dev   # http://localhost:5173, proxy /api vers le backend
```

## Reproduire la CI en local

### Backend (job `backend` de `ci.yml`)

```bash
cd backend
npm run format:check
npm run lint
npm run test:coverage   # échoue sous les seuils de vitest.config.ts
npm run build
npm audit --audit-level=high --omit=dev
```

### Frontend (job `frontend` de `ci.yml`)

```bash
cd frontend
npm run format:check
npm run lint
npm run check            # svelte-check
npm run test:ci          # inclut les tests PWA + couverture
npm run build
npm audit --audit-level=high --omit=dev
```

### Bout en bout (job `e2e`)

```bash
cd frontend
npx playwright install --with-deps chromium
npm run test:e2e   # construit puis sert dist/, teste le bundle réellement déployé
```

### Docker (job `docker`)

Démarre la vraie pile (healthchecks, nginx, en-têtes de sécurité, compression, cache) — à reproduire avant de toucher `docker-compose.yml`, `frontend/nginx.conf` ou un `Dockerfile` :

```bash
cp backend/.env.example backend/.env
docker compose up -d --wait --wait-timeout 120
curl -fsS localhost/api/sante
curl -fsSI localhost/ | grep -i content-security-policy
docker compose down -v
```

### Contrat des APIs externes

`npm run test:contract` (backend) appelle réellement Open-Meteo, Zippopotam et RainViewer — hors du chemin des PR, il tourne chaque nuit via `contract.yml`. À lancer seulement en cas de doute sur un schéma amont (voir [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)).

## Hook pre-push

Un hook Husky (`.husky/pre-push`) rejoue format, lint et `test:run` côté backend, puis format, lint, `svelte-check` et `test:run` côté frontend avant tout push. Il s'installe automatiquement via `npm install` à la racine (`prepare: husky`).

## Ouvrir une Pull Request

1. Créer une branche depuis `main` (`git checkout -b fix/mon-changement`).
2. Committer avec un message clair, idéalement au format `type: description` (`fix:`, `docs:`, `chore:`...).
3. Mettre à jour [`CHANGELOG.md`](./CHANGELOG.md) dans la section `[Non publié]`, avec la catégorie appropriée (`Added`, `Changed`, `Fixed`, `Security`, `Accessibility`) si le changement est notable pour un utilisateur ou un exploitant.
4. Vérifier que les jobs `backend`, `frontend`, `e2e` et `docker` passent.
5. Ouvrir la PR contre `main`.

## Ajouter une ville

Ajouter une entrée dans `backend/src/data/cities.ts` (id, nom, latitude, longitude, timezone). La liste exposée par `GET /api/villes` et le repli hors ligne du frontend en découlent automatiquement.

## Signaler un problème

Ouvrir une issue depuis l'onglet Issues du dépôt — le formulaire de bug demande la ville concernée, l'endpoint API et, si possible, l'en-tête `X-Request-Id` de la réponse en erreur (visible dans les logs : `docker compose logs backend | grep <identifiant>`). Vérifier d'abord [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) — les cas déjà rencontrés y sont documentés.

## Secrets

Ne jamais committer `backend/.env`, une IP Tailscale réelle, ou les secrets Android (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON`). `npm audit` tourne en CI sur les dépendances de production des deux paquets.
