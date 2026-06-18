# 🌤️ Météo Québec

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-orange?logo=svelte)](https://svelte.dev/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)](https://www.docker.com/)
[![Déployé](https://img.shields.io/badge/Déployé-qcweather.alithiel31.dev-blue)](https://qcweather.alithiel31.dev)
[![Cloudflare](https://img.shields.io/badge/Tunnel-Cloudflare-orange?logo=cloudflare)](https://www.cloudflare.com/)
[![Android](https://img.shields.io/badge/Android-Play%20Store-green?logo=google-play)](https://play.google.com/store/apps/details?id=dev.alithiel31.qcweather)

Application de prévisions météo pour le Québec : backend **Express / TypeScript** + frontend **Svelte 5 (PWA)**.
Données fournies par [Open-Meteo](https://open-meteo.com) — gratuit, sans clé API.

---

## Fonctionnalités

| Fonctionnalité | Détail |
|---|---|
| 🌡️ Conditions actuelles | Température, ressenti, vent, humidité |
| 🕐 Prévisions horaires | Heure par heure sur 48 h |
| 📅 Prévisions quotidiennes | 7 jours avec barres min–max et heures de lever/coucher |
| 🛰️ Carte animée | Satellite nuages (infrarouge) + radar précipitations via RainViewer + Leaflet |
| 📮 Recherche par code postal | Géocodage de la RTA québécoise (G, H, J) via Zippopotam |
| 🏙️ Bascule Montréal ↔ Québec | Choix mémorisé entre les sessions |
| 🌅 Ciel dynamique | Dégradé d'arrière-plan selon les conditions et le jour/nuit |
| 📱 PWA installable | Fonctionne hors ligne — dernières prévisions en cache |
| ⚡ Cache serveur | Configurable via `.env` pour limiter les appels à Open-Meteo |

---

## Déploiement (Docker)

C'est la méthode recommandée. Le `docker-compose.yml` lance le backend (port **3005**) et le frontend Nginx (port **80**).

**1. Configurer l'environnement**

```bash
cp backend/.env.example backend/.env
# Éditer backend/.env avec ta propre IP Tailscale si nécessaire
```

**2. Lancer**

```bash
docker compose up --build -d
```

L'application tourne sur un **Raspberry Pi** et est exposée publiquement via un **tunnel Cloudflare** (aucun port à ouvrir sur le routeur).
Nginx fait office de reverse proxy à l'intérieur du conteneur frontend : il sert les fichiers statiques et redirige les appels `/api/` vers le backend.
Le tunnel Cloudflare gère le **HTTPS** et le nom de domaine `qcweather.alithiel31.dev` — aucun certificat à gérer manuellement.

---

## Android (TWA)

L'application est publiée sur le **Google Play Store** sous forme de TWA (Trusted Web Activity) : une coquille Android légère qui charge directement le PWA depuis `https://qcweather.alithiel31.dev`.

**Package ID :** `dev.alithiel31.qcweather` — Sources : `twa-qcweather/`

### Workflows CI/CD

| Workflow | Déclencheur | Rôle |
|---|---|---|
| `build-twa.yml` | Push sur `twa-qcweather/**` ou manuel | Build + signature du `.aab` |
| `deploy-twa.yml` | Après `build-twa.yml` réussi ou manuel | Publication sur Play Store (Internal Testing) |

> `deploy-twa.yml` nécessite une **première soumission manuelle** dans Play Console — Google exige qu'une version existe déjà sur la piste avant d'accepter les uploads via API.

### Secrets GitHub requis

| Secret | Description |
|---|---|
| `KEYSTORE_BASE64` | Keystore Android encodé en base64 |
| `KEYSTORE_PASSWORD` | Mot de passe du keystore |
| `KEY_PASSWORD` | Mot de passe de la clé de signature |
| `PLAY_SERVICE_ACCOUNT_JSON` | Clé JSON du Service Account Google Play API |

### Configurer le Service Account (une fois)

1. [Google Cloud Console](https://console.cloud.google.com) → IAM & Admin → Service Accounts → Créer
2. Télécharger la clé JSON → ajouter comme secret `PLAY_SERVICE_ACCOUNT_JSON`
3. Play Console → Setup → API access → lier le service account → rôle **Release Manager**

---

## Variables d'environnement

| Variable | Obligatoire | Défaut | Description |
|---|---|---|---|
| `PORT` | ❌ | `3005` | Port du backend |
| `NODE_ENV` | ❌ | `development` | Environnement (`production` en prod) |
| `TAILSCALE_IP` | ❌ | — | IP Tailscale pour l'accès réseau distant |
| `CACHE_TTL_PREVISIONS` | ❌ | `600000` | Durée du cache météo en ms (défaut : 10 min) |
| `CACHE_TTL_GEOCODE` | ❌ | `2592000000` | Durée du cache géocodage en ms (défaut : 30 jours) |
| `DEFAULT_TIMEZONE` | ❌ | `America/Toronto` | Timezone pour les prévisions Open-Meteo |

---

## Développement local

### Backend (port 3005)

```bash
cd backend && npm install
npm run dev        # rechargement auto (tsx --watch)
```

Routes disponibles :

| Route | Description |
|---|---|
| `GET /api/villes` | Liste des villes disponibles |
| `GET /api/previsions/:ville` | Prévisions par ville (`montreal`, `quebec`) |
| `GET /api/previsions-coordonnees?lat=&lon=&nom=` | Prévisions pour un point GPS |
| `GET /api/geocode/:rta` | Géocode une RTA québécoise (ex. `H2X`) |
| `GET /api/sante` | Vérification de l'état du service |

### Frontend (port 5173)

```bash
cd frontend && npm install
npm run dev
```

Ouvrir `http://localhost:5173`. Le proxy Vite redirige `/api` vers le backend.

---

## Structure

```
meteo-qc/
├── docker-compose.yml
├── backend/
│   ├── app.ts                      # Point d'entrée
│   ├── .env.example                # Template des variables d'environnement
│   └── src/
│       ├── config.ts               # Port, timezone, cache, Tailscale
│       ├── data/cities.ts          # Villes et coordonnées
│       ├── routers/                # Définition des routes
│       ├── controllers/            # Logique des requêtes
│       ├── services/               # Open-Meteo, géocodage, cache
│       └── middlewares/            # Gestion globale des erreurs
└── frontend/
    └── src/
        ├── App.svelte              # Ville active, ciel dynamique, conditions
        └── lib/
            ├── Horaire.svelte      # Bandeau 48 h
            ├── CarteNuages.svelte  # Carte Leaflet animée
            ├── Quotidien.svelte    # Prévisions 7 jours
            ├── api.ts              # Appels backend
            ├── meteo.ts            # Codes WMO → labels FR, icônes
            └── types.ts            # Interfaces TypeScript
```

---

## Ajouter une ville

Ajouter une entrée dans `backend/src/data/cities.ts`.

---

## Notes

**Précision des codes postaux** — l'application utilise la RTA (3 premiers caractères, ex. `H2X`) plutôt que le code complet, ce qui localise au quartier près — suffisant pour la résolution des modèles météo (quelques kilomètres).

---

## Stack

| Couche | Technologie |
|---|---|
| Backend | Express 5 · Node.js 18+ · TypeScript 5.6 |
| Frontend | Svelte 5 · TypeScript · Vite 8 |
| PWA | vite-plugin-pwa · Service Worker (network-first) |
| Carte | Leaflet · RainViewer |
| Infra | Docker · Nginx |
| Accès réseau | Tailscale |
| APIs externes | Open-Meteo · Zippopotam.us · CARTO / OpenStreetMap |
| Android | TWA · Bubblewrap · Google Play Store |
| CI/CD | GitHub Actions (`ci.yml` · `build-twa.yml` · `deploy-twa.yml`) |

## License

MIT — voir [LICENSE](./LICENSE)
