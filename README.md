# 🌤️ Météo Québec

🇬🇧 [English version](./README.en.md)

[![CI](https://github.com/Alithiel31/WeatherQC/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Alithiel31/WeatherQC/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-orange?logo=svelte)](https://svelte.dev/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)](https://www.docker.com/)
[![Déployé](https://img.shields.io/badge/Déployé-qcweather.alithiel31.dev-blue)](https://qcweather.alithiel31.dev)
[![Cloudflare](https://img.shields.io/badge/Tunnel-Cloudflare-orange?logo=cloudflare)](https://www.cloudflare.com/)
[![Android](https://img.shields.io/badge/Android-Test%20interne-yellow?logo=google-play)](https://play.google.com/store/apps/details?id=dev.alithiel31.qcweather)

Application de prévisions météo pour le Québec : backend **Express / TypeScript** + frontend **Svelte 5 (PWA)**.
Données fournies par [Open-Meteo](https://open-meteo.com) — gratuit, sans clé API.

---

## Fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| 🌡️ Conditions actuelles | Température, ressenti, vent, humidité |
| 🕐 Prévisions horaires | Heure par heure sur 48 h |
| 📅 Prévisions quotidiennes | 7 jours avec barres min–max et heures de lever/coucher |
| 🛰️ Carte animée | Satellite nuages (infrarouge) + radar précipitations via RainViewer + Leaflet, avec repli sur la couverture nuageuse OpenWeatherMap quand RainViewer n'a pas d'image satellite |
| 📮 Recherche par code postal | Géocodage de la RTA québécoise (G, H, J) via Zippopotam |
| 🏙️ Sélection de ville | 6 villes disponibles (Montréal, Québec, Gatineau, Sherbrooke, Trois-Rivières, Saguenay), choix mémorisé entre les sessions |
| 🌅 Ciel dynamique | Dégradé d'arrière-plan selon les conditions et le jour/nuit |
| 📱 PWA installable | Fonctionne hors ligne — dernières prévisions en cache |
| 🔔 Alertes météo | Notifications push facultatives, par ville, sur changement brusque (précipitation, chute de température, vent, verglas, orage) — voir la section dédiée plus bas |
| ⚡ Cache serveur | Configurable via `.env` pour limiter les appels à Open-Meteo |

---

## Architecture

Backend Express en proxy-cache devant Open-Meteo, Zippopotam et RainViewer ; frontend Svelte 5 en PWA installable ; coquille TWA Android — le tout derrière nginx et un tunnel Cloudflare, sur un Raspberry Pi. Le backend Express est le seul composant qui appelle les APIs externes, jamais directement depuis le navigateur.

Diagramme complet, résilience des amonts (mutualisation, cache dégradé, disjoncteur) et structure détaillée du dépôt : voir [docs/architecture.md](./docs/architecture.md).

---

## Déploiement (Docker)

C'est la méthode recommandée. Le `docker-compose.yml` lance le backend (port **3005**) et le frontend Nginx (port **80**).

**1. Configurer l'environnement**

```bash
cp backend/.env.example backend/.env
# Éditer backend/.env avec ta propre IP Tailscale si nécessaire

cp frontend/.env.example frontend/.env
# Éditer frontend/.env avec une clé OpenWeatherMap (gratuite) pour activer le repli
# de la carte satellite — laisser vide se contente d'afficher un message
# d'indisponibilité quand RainViewer n'a pas d'image — et avec une clé CARTO
# (gratuite, https://carto.com/basemaps/apikey/) pour que le fond de carte
# s'affiche sans le filigrane « API KEY REQUIRED ». Ce même fichier sert aussi
# de config Vite en développement local (`npm run dev` dans frontend/) : docker
# compose le lit via le flag --env-file (voir la commande ci-dessous).
```

**2. Lancer**

```bash
docker compose --env-file frontend/.env up --build -d
```

Nginx pose les en-têtes de sécurité du document — CSP, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, HSTS. `helmet` ne couvre que les réponses JSON de
`/api/` : le HTML qui exécute le JavaScript est servi par nginx, pas par Express.

> **Avant d'éditer `frontend/nginx.conf`** — `add_header` ne fusionne pas : un bloc `location`
> qui en déclare un seul perd **tous** ceux hérités du `server`. Les en-têtes sont donc posés
> une seule fois, et la politique de cache s'appuie sur `expires`, qui n'a pas cet effet. Le
> job `docker` de la CI vérifie que `assetlinks.json` porte toujours sa CSP.

L'application tourne sur un **Raspberry Pi** et est exposée publiquement via un **tunnel Cloudflare** (aucun port à ouvrir sur le routeur).
Nginx fait office de reverse proxy à l'intérieur du conteneur frontend : il sert les fichiers statiques et redirige les appels `/api/` vers le backend.
Le tunnel Cloudflare gère le **HTTPS** et le nom de domaine `qcweather.alithiel31.dev` — aucun certificat à gérer manuellement.

> **Ne jamais lancer `docker compose up` à la main depuis un poste de dev pointant (via
> contexte Docker distant) sur Caesura pour un déploiement de prod.** Docker Compose nomme le
> projet d'après le dossier local d'où la commande est lancée : un nom différent du dossier de
> travail du CI (`WeatherQC`) crée un **second stack de conteneurs**, qui se dispute le port 80
> avec celui géré par `deploy-web.yml` — vécu concrètement, voir
> [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md#6-le-déploiement-ci-reste-bloqué-en-queuedpending-indéfiniment).
> Pour la prod, toujours passer par `npm run deploy:web` ; réserver `docker compose up` à la
> main au développement/test local.

**Déploiement continu** : `deploy-web.yml` tourne sur un runner self-hosted installé sur le Pi
lui-même et se déclenche automatiquement à chaque push sur `main` touchant `backend/`,
`frontend/` ou `docker-compose.yml` (ou manuellement). Il rejoue `docker compose --env-file frontend/.env up -d --build
--wait` sur place — le Pi va chercher le job en se connectant vers GitHub, aucun port entrant ni
clé SSH à exposer. Pour le déclencher et suivre le déploiement en direct depuis un poste local :

```bash
npm run deploy:web       # ou deploy:android pour build-twa.yml
```

---

## Android (TWA)

L'application est en **test interne** (Internal Testing) sur le Google Play Store, sous forme de TWA (Trusted Web Activity) qui charge directement le PWA depuis `https://qcweather.alithiel31.dev`. Package ID : `dev.alithiel31.qcweather` — sources : `twa-qcweather/`.

Workflows CI/CD, secrets GitHub requis et configuration du Service Account Google Play : voir [docs/android.md](./docs/android.md).

---

## Variables d'environnement

Configuration backend validée par Zod au démarrage (`PORT`, caches, rate-limit, disjoncteur, VAPID pour les alertes push...) et variable de build frontend pour les clés de carte.

Liste complète avec valeurs par défaut : voir [docs/environnement.md](./docs/environnement.md).

---

## Développement local

```bash
cd backend && npm install && npm run dev    # port 3005
cd frontend && npm install && npm run dev   # port 5173
```

Routes disponibles, résilience réseau, tests unitaires/intégration/contrat, tests de bout en bout et vérifications PWA : voir [docs/developpement.md](./docs/developpement.md).

---

## Notifications d'alertes météo

Abonnement facultatif, par ville, à des alertes Web Push déclenchées par un changement météo brusque — précipitation imminente, chute de température, vent fort, verglas, orage.

Détection, stockage des abonnements, cycle de vérification horaire et intégration frontend : voir [docs/notifications.md](./docs/notifications.md).

---

## Ajouter une ville

Ajouter une entrée dans `backend/src/data/cities.ts`.

---

## Notes

**Précision des codes postaux** — l'application utilise la RTA (3 premiers caractères, ex. `H2X`) plutôt que le code complet, ce qui localise au quartier près — suffisant pour la résolution des modèles météo (quelques kilomètres).

---

## Vie privée et conditions

Trois pages statiques, servies depuis `frontend/public/` et liées depuis le pied de l'application. Le français est la version officielle — le service est offert au public au Québec — et les versions anglaises sont des traductions de courtoisie.

| Document | Français | English |
|---|---|---|
| Politique de confidentialité | [`/privacy-policy.html`](https://qcweather.alithiel31.dev/privacy-policy.html) | [`/privacy-policy.en.html`](https://qcweather.alithiel31.dev/privacy-policy.en.html) |
| Conditions d'utilisation | [`/terms.html`](https://qcweather.alithiel31.dev/terms.html) | [`/terms.en.html`](https://qcweather.alithiel31.dev/terms.en.html) |
| Mentions légales | [`/legal.html`](https://qcweather.alithiel31.dev/legal.html) | [`/legal.en.html`](https://qcweather.alithiel31.dev/legal.en.html) |

> ⚠️ **`privacy-policy.html` ne doit pas être renommée.** Cette URL exacte est déclarée dans la Play
> Console ; la déplacer casse la fiche de l'application, et l'échec n'apparaît qu'à la prochaine
> revue par Google. `tests/pwa/build.test.ts` et le job `docker` de la CI la vérifient.

Ces pages ne dépendent d'aucun routeur : ce sont des fichiers HTML autonomes que Vite copie dans
`dist/`, que nginx sert par son repli `location /`, et que Workbox précache — d'où leur
consultation possible hors ligne. **Le précache n'est pas décoratif** : sans lui, le
`navigateFallback` du service worker rendrait la coquille de l'application à leur place.

Le contenu décrit ce que le code fait réellement — clés de `localStorage`, tiers appelés par le
navigateur *et* par le backend, journaux, limitation par IP. Toute modification du traitement des
données doit s'y répercuter, ainsi que dans le formulaire **Data Safety** de la Play Console, qui
se tient à jour dans la console et non dans ce dépôt.

---

## Stack

| Couche | Technologie |
|---|---|
| Backend | Express 5 · Node.js 22+ · TypeScript 5.6 |
| Frontend | Svelte 5 · TypeScript · Vite 8 |
| PWA | vite-plugin-pwa · Service Worker (network-first) |
| Carte | Leaflet · RainViewer |
| Infra | Docker · Nginx |
| Accès réseau | Tailscale |
| APIs externes | Open-Meteo · Zippopotam.us · CARTO / OpenStreetMap · RainViewer · OpenWeatherMap |
| Android | TWA · Bubblewrap · Google Play Store |
| CI/CD | GitHub Actions (`ci.yml` · `android.yml` · `build-twa.yml` · `deploy-twa.yml` · `deploy-web.yml` · `codeql.yml` · `secrets.yml` · `contract.yml`) |

## Documentation approfondie

- [Architecture, résilience et structure du dépôt](./docs/architecture.md)
- [Android (TWA)](./docs/android.md)
- [Variables d'environnement](./docs/environnement.md)
- [Développement local](./docs/developpement.md)
- [Notifications d'alertes météo](./docs/notifications.md)
- [Veille des APIs tierces](./docs/veille-api-tierces.md)
- [Guide de reprise](./docs/guide-de-reprise.md)
- [Accessibilité](./docs/accessibilite.md)

## Contribuer

Environnement de développement, reproduction de la CI en local, convention de commit : voir [CONTRIBUTING.md](./CONTRIBUTING.md).

## Dépannage

Cas connus (config nginx, calibrage réseau, CI) : voir [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## Sécurité

Pour signaler une vulnérabilité, voir [SECURITY.md](./SECURITY.md) — pas d'issue publique.

## License

MIT — voir [LICENSE](./LICENSE)

---

Fait par **Jacques Duchamplecheval** ([alithiel31](https://github.com/Alithiel31)) — [alithiel31.dev](https://alithiel31.dev) · [LinkedIn](https://linkedin.com/in/jacques-duchamplecheval) · [contact@alithiel31.dev](mailto:contact@alithiel31.dev)
