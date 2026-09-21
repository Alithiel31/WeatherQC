# Sécurité

🇬🇧 [English version](./SECURITY.en.md)

## Signaler une vulnérabilité

Merci de ne **pas** ouvrir d'issue publique pour signaler une faille de sécurité — une issue
GitHub classique l'expose à tout le monde avant qu'un correctif n'existe.

Deux façons de signaler, dans l'ordre de préférence :

1. **[Signaler une vulnérabilité](https://github.com/Alithiel31/WeatherQC/security/advisories/new)**
   via l'onglet Security du dépôt (GitHub Security Advisories) — le rapport reste privé entre toi
   et le mainteneur, et permet une divulgation coordonnée une fois le correctif publié.
2. Par courriel à [contact@alithiel31.dev](mailto:contact@alithiel31.dev), avec `SECURITY` dans
   l'objet, et si possible : le composant concerné (backend, frontend, `twa-qcweather/`, CI), les
   étapes de reproduction, et l'impact envisagé.

### Ce qu'on peut promettre

- Accusé de réception sous **72 heures**.
- Le projet est maintenu par une seule personne, sur son temps libre : pas de SLA formel au-delà
  de l'accusé de réception, mais une faille confirmée à impact réel passe devant tout le reste.
- Crédit dans le [`CHANGELOG.md`](./CHANGELOG.md) une fois le correctif publié, sauf préférence
  contraire de ta part.
- Pas de programme de bug bounty — c'est un projet personnel, pas une entreprise.

## Périmètre

Dans le périmètre :

- Le backend Express (`backend/`) et ses dépendances directes.
- Le frontend Svelte/PWA (`frontend/`) et ses dépendances directes.
- La configuration Docker/nginx (`docker-compose.yml`, `frontend/nginx.conf`, les `Dockerfile`).
- Les workflows GitHub Actions (`.github/workflows/`) — en particulier ceux qui manipulent le
  keystore Android et le service account Play Store.
- La coquille Android TWA (`twa-qcweather/`).

Hors périmètre :

- Les APIs tierces consommées (Open-Meteo, Zippopotam, RainViewer, OpenWeatherMap, CARTO) — à
  signaler directement à leurs équipes respectives.
- Une faille nécessitant un accès physique au Raspberry Pi qui héberge le service, ou un accès
  déjà privilégié à l'infrastructure (Tailscale, tunnel Cloudflare).
- Le volumétrique pur (déni de service par submersion) : la limitation de débit documentée dans
  le [README](./README.md) est une atténuation, pas une garantie d'absorber un trafic hostile
  massif — un endpoint qui y échappe, en revanche, est bien dans le périmètre.
- L'ingénierie sociale visant le mainteneur ou des tiers.

## Ce qui est déjà en place

Avant de signaler un problème déjà couvert, quelques mécanismes existants (détaillés dans le
[README](./README.md)) :

- **Dépendances** — `npm audit --audit-level=high` bloque la CI sur les dépendances de
  production ; Dependabot ouvre une PR hebdomadaire par écosystème (npm, Docker, Gradle, GitHub
  Actions).
- **Secrets** — le workflow `secrets.yml` (gitleaks) scanne tout l'historique à chaque push,
  chaque PR et chaque semaine.
- **Entrées** — tous les paramètres de requête sont validés par Zod
  (`backend/src/schemas/validation.ts`) ; toutes les réponses des APIs amont le sont aussi
  (`backend/src/schemas/*.schema.ts`) — une dérive de contrat externe donne un 502, jamais un
  traitement de données non validées.
- **En-têtes** — `helmet` côté API, CSP/HSTS/`X-Content-Type-Options` posés par nginx côté
  document HTML (voir `frontend/nginx.conf`).
- **Images de base** — les images Docker (`node:*-alpine`, `nginx:alpine`) sont mises à jour
  chaque semaine via Dependabot, et `apk update && apk upgrade` s'exécute à chaque build pour
  absorber un correctif publié entre deux tags.

## Versions supportées

Un seul déploiement, pas de branches de version : seul le code sur `main` — celui réellement en
production sur `qcweather.alithiel31.dev` — reçoit des correctifs de sécurité.
