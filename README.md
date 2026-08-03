# 🌤️ Météo Québec

[![Node.js](https://img.shields.io/badge/Node.js-22+-green?logo=node.js)](https://nodejs.org/)
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
| `build-twa.yml` | Push sur `twa-qcweather/**` **depuis `main`** ou manuel | Build + signature du `.aab` |
| `deploy-twa.yml` | Après `build-twa.yml` réussi, ou manuel depuis `main` | Publication sur Play Store (Internal Testing) |

> Le build n'est déclenché que depuis `main` : le keystore de production n'est jamais
> déchiffré sur une branche de travail. Pour tester un changement TWA avant merge,
> utiliser le déclenchement manuel (`workflow_dispatch`).

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
| `PUBLIC_ORIGINS` | ❌ | — | Origines CORS autorisées en plus du poste local et de Tailscale, séparées par des virgules |
| `FETCH_TIMEOUT_MS` | ❌ | `5000` | Délai maximal d'un appel à Open-Meteo / Zippopotam |
| `TRUST_PROXY_HOPS` | ❌ | `2` | Nombre de proxies devant l'API (cloudflared + nginx) |
| `RATE_LIMIT_WINDOW_MS` | ❌ | `60000` | Fenêtre de la limitation de débit |
| `RATE_LIMIT_MAX` | ❌ | `100` | Requêtes/fenêtre/IP sur `/api` |
| `RATE_LIMIT_GEOCODE_MAX` | ❌ | `20` | Requêtes/fenêtre/IP sur `/api/geocode` |
| `CACHE_TTL_PREVISIONS` | ❌ | `600000` | Durée du cache météo en ms (défaut : 10 min) |
| `CACHE_TTL_GEOCODE` | ❌ | `2592000000` | Durée du cache géocodage en ms (défaut : 30 jours) |
| `CACHE_TTL_RAINVIEWER` | ❌ | `300000` | Durée du cache de l'index RainViewer en ms (défaut : 5 min) |
| `CACHE_MAX_ENTRIES` | ❌ | `500` | Plafond du nombre d'entrées en cache (éviction LRU) |
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
| `GET /api/geocode/:codePostal` | Géocode une RTA québécoise (ex. `H2X`) |
| `GET /api/rainviewer` | Index des images satellite et radar pour la carte animée |
| `GET /api/sante` | Vérification de l'état du service |

Les appels aux APIs externes sont bornés par `FETCH_TIMEOUT_MS` et rejoués une fois en cas
d'erreur réseau ou 5xx. Un amont qui ne répond pas à temps donne un **504**, un amont en
erreur un **502** — jamais une requête suspendue.

Les trois amonts passent par ce même chemin, RainViewer compris : son index transitait
autrefois directement du navigateur vers `api.rainviewer.com`, sans cache ni quota. Seul
l'**index** est proxifié — les tuiles restent chargées en direct depuis
`tilecache.rainviewer.com`, les faire transiter par le Raspberry Pi coûterait bien plus cher
que ce que le cache ferait gagner. En contrepartie, la carte dépend désormais du backend :
si celui-ci est injoignable, elle affiche son message de repli au lieu de se débrouiller
seule.

Les origines CORS autorisées sont le poste de développement, l'IP Tailscale si elle est
configurée, et celles déclarées par `PUBLIC_ORIGINS`. En production, nginx proxifie `/api/`
en same-origin : aucune requête ne porte d'en-tête `Origin`, donc un domaine public absent de
la liste ne se voit sur aucune requête réelle — jusqu'au jour où un client est servi depuis
un autre hôte.

L'API est exposée publiquement : en-têtes de durcissement (`helmet`), corps JSON plafonné à
10 ko et limitation de débit par IP cliente (**429** au-delà du quota). `/api/sante` n'est
jamais limité — le healthcheck Docker l'interroge toutes les 30 s.

Les réponses des APIs externes sont validées avant usage : une dérive de schéma chez Open-Meteo
ou Zippopotam donne un **502** nommant le champ fautif, jamais un 500. Toutes les erreurs
partagent la même enveloppe `{ status, error }`, à laquelle les erreurs de validation ajoutent
`details`.

Chaque réponse porte un en-tête `X-Request-Id` — repris de l'amont s'il est fourni — qu'on
retrouve dans les logs. Un utilisateur qui signale une panne peut citer cet identifiant :

```bash
docker compose logs backend | grep <identifiant>
```

Une variable d'environnement invalide (`PORT=abc`, quota vide) fait échouer le démarrage en la
nommant, au lieu de laisser tourner le serveur avec un `NaN`.

> **Calibrage de `TRUST_PROXY_HOPS`** — la limitation de débit s'applique par IP cliente.
> Derrière cloudflared puis nginx, il faut remonter 2 sauts pour retrouver le vrai client ;
> mal réglé, tous les visiteurs partagent le même compteur. Après un changement d'infra,
> vérifier avec `curl -s https://qcweather.alithiel31.dev/api/villes -D - | grep -i ratelimit`
> depuis deux réseaux différents : les compteurs doivent être indépendants.

### Tests (backend)

| Commande | Portée | Réseau |
|---|---|---|
| `npm run test:run` | Unitaires + intégration — lancé par le hook `pre-push` | ❌ aucun appel réseau |
| `npm run test:coverage` | Idem + rapport de couverture — **c'est ce que lance la CI** | ❌ aucun appel réseau |
| `npm run test:contract` | Vérifie le contrat réel d'Open-Meteo, de Zippopotam et de RainViewer | ✅ appels réels |

Les tests d'intégration s'appuient sur les fixtures de `backend/tests/fixtures/` : une panne
d'API externe ne peut plus faire échouer une PR. `tests/setup.ts` fait échouer explicitement
tout appel réseau non mocké.

Les tests de contrat tournent séparément via le workflow `contract.yml` (nocturne + manuel) :
c'est lui qui détecte une dérive de schéma chez les APIs externes.

`test:coverage` échoue sous les seuils déclarés dans `backend/vitest.config.ts`. Ils sont
calés **sous la mesure réelle**, pas sur un chiffre rond : ils bloquent une régression
franche sans casser la CI dès qu'un refactor ajoute une garde difficile à atteindre.
`app.ts` est exclu de la mesure — il ne contient que `listen()` et les gestionnaires de
signaux, dont la vérification réelle est le healthcheck Docker.

### Frontend (port 5173)

```bash
cd frontend && npm install
npm run dev
```

Ouvrir `http://localhost:5173`. Le proxy Vite redirige `/api` vers le backend.

Tous les appels réseau passent par `src/lib/api.ts` — c'est le seul endroit où `fetch`
est appelé côté frontend, ce qui permet de le stubber d'un bloc dans les tests.

### Tests (frontend)

| Commande | Portée |
|---|---|
| `npm run test` | Mode watch pendant le développement |
| `npm run test:run` | Une passe complète |
| `npm run test:coverage` | Idem + rapport de couverture |
| `npm run test:ci` | Idem + `rapport-tests.json` — **c'est ce que lance la CI** |
| `npm run test:pwa` | Uniquement les vérifications PWA (manifeste + service worker) |

La CI publie `frontend/coverage/` et `frontend/rapport-tests.json` en artefact
(`frontend-rapports`, conservé 14 jours), y compris quand le job échoue — c'est là que le
rapport est le plus utile.

Environnement `jsdom` + Testing Library. Comme côté backend, `tests/setup.ts` fait échouer
explicitement tout appel réseau non mocké : un test ne peut pas dépendre de la disponibilité
du backend ou de RainViewer.

Les seuils de couverture vivent dans `frontend/vitest.config.ts`, calés sous la mesure
réelle. `src/main.ts` en est exclu : il ne fait que monter l'app et enregistrer le service
worker.

### Vérifications PWA

`tests/pwa/build.test.ts` reconstruit l'app et lit la sortie de `dist/` pour vérifier les
deux promesses affichées plus haut — installabilité et fonctionnement hors ligne :

- le manifeste déclare `display: standalone`, un `start_url`, les icônes 192/512 et une
  icône `maskable`, et n'y référence que des fichiers réellement présents ;
- le service worker est généré, enregistré par le bundle, et précache la coquille ;
- les stratégies de cache attendues sont bien câblées (`NetworkFirst` sur
  `/api/previsions`, `CacheFirst` sur les tuiles de fond).

```bash
cd frontend && npm run test:pwa
```

> **Pourquoi pas Lighthouse** — depuis Lighthouse 12, la catégorie PWA et ses audits
> (`installable-manifest`, `service-worker`) ont été **supprimés** ; Lighthouse 13 ne
> connaît plus que `performance`, `accessibility`, `best-practices` et `seo`. Auditer
> l'installabilité imposerait d'épingler une version abandonnée, plus un Chrome headless
> et un serveur statique en CI. Les mêmes garanties se lisent dans la sortie de build,
> en quelques secondes et sans navigateur.

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
    ├── src/
    │   ├── main.ts                 # Montage de l'app + service worker
    │   ├── App.svelte              # Ville active, ciel dynamique, conditions
    │   └── lib/
    │       ├── Horaire.svelte      # Bandeau 48 h
    │       ├── CarteNuages.svelte  # Carte Leaflet animée
    │       ├── Quotidien.svelte    # Prévisions 7 jours
    │       ├── api.ts              # Appels backend et RainViewer
    │       ├── meteo.ts            # Codes WMO → labels FR, icônes
    │       └── types.ts            # Interfaces TypeScript
    └── tests/
        ├── unit/                   # meteo.ts, api.ts
        ├── composants/             # Rendu Svelte (Testing Library)
        ├── pwa/                    # Manifeste installable + service worker
        └── helpers/                # Stubs de fetch
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
| Backend | Express 5 · Node.js 22+ · TypeScript 5.6 |
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
