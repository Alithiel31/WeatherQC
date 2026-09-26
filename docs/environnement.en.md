# Environment variables

🇫🇷 [Version française](./environnement.md)

[Back to README](../README.en.md)

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | ❌ | `3005` | Backend port |
| `NODE_ENV` | ❌ | `development` | Environment (`production` in prod) |
| `TAILSCALE_IP` | ❌ | — | Tailscale IP for remote network access |
| `PUBLIC_ORIGINS` | ❌ | — | CORS origins allowed in addition to the local machine and Tailscale, comma-separated |
| `FETCH_TIMEOUT_MS` | ❌ | `5000` | Max delay of a call to Open-Meteo / Zippopotam / Open-Meteo Geocoding |
| `TRUST_PROXY_HOPS` | ❌ | `2` | Number of proxies in front of the API (cloudflared + nginx) |
| `RATE_LIMIT_WINDOW_MS` | ❌ | `60000` | Rate limiting window |
| `RATE_LIMIT_MAX` | ❌ | `100` | Requests/window/IP on `/api` |
| `RATE_LIMIT_GEOCODE_MAX` | ❌ | `20` | Requests/window/IP on `/api/geocode` and `/api/geocode-ville` |
| `CACHE_TTL_PREVISIONS` | ❌ | `600000` | Weather cache duration in ms (default: 10 min) |
| `CACHE_TTL_GEOCODE` | ❌ | `2592000000` | Geocoding cache duration in ms (default: 30 days) |
| `CACHE_TTL_RAINVIEWER` | ❌ | `300000` | RainViewer index cache duration in ms (default: 5 min) |
| `CACHE_MAX_ENTRIES` | ❌ | `500` | Cache entry cap (LRU eviction) |
| `CACHE_FACTEUR_OBSOLETE` | ❌ | `6` | An entry stays servable `factor × TTL` past expiry if the upstream fails |
| `BREAKER_SEUIL_ECHECS` | ❌ | `5` | Consecutive failures before suspending calls to an upstream |
| `BREAKER_REPOS_MS` | ❌ | `30000` | Suspension duration before the test request |
| `DEFAULT_TIMEZONE` | ❌ | `America/Toronto` | Timezone for Open-Meteo forecasts |
| `VAPID_PUBLIC_KEY` | ❌ | — | Public VAPID key for weather alert push notifications (generated with `npx web-push generate-vapid-keys`) — missing, alert subscriptions stay unavailable |
| `VAPID_PRIVATE_KEY` | ❌ | — | Matching private VAPID key — must be supplied together with `VAPID_PUBLIC_KEY`, never alone |
| `VAPID_CONTACT_EMAIL` | ❌ | `mailto:contact@alithiel31.dev` | Contact shown to browsers receiving notifications (required by the Web Push protocol) |
| `DB_PATH` | ❌ | `data/abonnements.sqlite` | SQLite file for weather alert subscriptions — mounted on a named Docker volume in production |

Frontend **build** variable (`frontend/.env`, read both by Vite in local development and by
`docker compose` via the `--env-file frontend/.env` flag — see `frontend/.env.example` for
details) : unlike the table above, it isn't validated by Zod server-side, it gets embedded into
the JS bundle by Vite at build time. Compose has no root-level `env_file` directive : the flag
must accompany every invocation touching `docker-compose.yml` (see CI and `deploy-web.yml`).

| Variable | Required | Default | Description |
|---|---|---|---|
| `VITE_OPENWEATHERMAP_KEY` | ❌ | — | OpenWeatherMap API key (free) for the satellite map fallback ; empty = unavailability message instead of the fallback |
| `VITE_CARTO_API_KEY` | ⚠️ recommended | — | CARTO API key (free — [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/), emailed with no waitlist) for the base map on the "Clouds" tab ; empty = tiles still served but covered by CARTO's "API KEY REQUIRED" watermark since late August 2026 |
