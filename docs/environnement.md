# Variables d'environnement

🇬🇧 [English version](./environnement.en.md)

[Retour au README](../README.md)

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
| `CACHE_FACTEUR_OBSOLETE` | ❌ | `6` | Une entrée reste servable `facteur × TTL` après péremption si l'amont échoue |
| `BREAKER_SEUIL_ECHECS` | ❌ | `5` | Échecs consécutifs avant suspension des appels à un amont |
| `BREAKER_REPOS_MS` | ❌ | `30000` | Durée de la suspension avant la requête de test |
| `DEFAULT_TIMEZONE` | ❌ | `America/Toronto` | Timezone pour les prévisions Open-Meteo |
| `VAPID_PUBLIC_KEY` | ❌ | — | Clé publique VAPID pour les notifications push d'alertes météo (générée avec `npx web-push generate-vapid-keys`) — absente, l'abonnement aux alertes reste indisponible |
| `VAPID_PRIVATE_KEY` | ❌ | — | Clé privée VAPID correspondante — doit être fournie avec `VAPID_PUBLIC_KEY`, jamais seule |
| `VAPID_CONTACT_EMAIL` | ❌ | `mailto:contact@alithiel31.dev` | Contact affiché aux navigateurs recevant les notifications (exigé par le protocole Web Push) |
| `DB_PATH` | ❌ | `data/abonnements.sqlite` | Fichier SQLite des abonnements aux alertes météo — monté sur un volume Docker nommé en production |

Variable de **build** frontend (`frontend/.env`, lue à la fois par Vite en développement local
et par `docker compose` via le flag `--env-file frontend/.env` — voir `frontend/.env.example`
pour le détail) : contrairement au tableau ci-dessus, elle n'est pas validée par Zod côté
serveur, elle est embarquée dans le bundle JS par Vite au moment du build. Compose ne supporte
pas de directive `env_file` au niveau racine du fichier : le flag doit accompagner chaque
invocation touchant `docker-compose.yml` (voir CI et `deploy-web.yml`).

| Variable | Obligatoire | Défaut | Description |
|---|---|---|---|
| `VITE_OPENWEATHERMAP_KEY` | ❌ | — | Clé API OpenWeatherMap (gratuite) pour le repli de la carte satellite ; vide = message d'indisponibilité au lieu du repli |
| `VITE_CARTO_API_KEY` | ⚠️ recommandée | — | Clé API CARTO (gratuite — [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/), envoyée par courriel sans file d'attente) pour le fond de carte de l'onglet « Nuages » ; vide = tuiles servies quand même mais recouvertes du filigrane CARTO « API KEY REQUIRED » depuis fin août 2026 |
