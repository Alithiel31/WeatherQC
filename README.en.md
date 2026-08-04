# 🌤️ Météo Québec

🇫🇷 [Version française](./README.md) — this is the canonical version of this document.

[![Node.js](https://img.shields.io/badge/Node.js-22+-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-orange?logo=svelte)](https://svelte.dev/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)](https://www.docker.com/)
[![Deployed](https://img.shields.io/badge/Deployed-qcweather.alithiel31.dev-blue)](https://qcweather.alithiel31.dev)
[![Cloudflare](https://img.shields.io/badge/Tunnel-Cloudflare-orange?logo=cloudflare)](https://www.cloudflare.com/)
[![Android](https://img.shields.io/badge/Android-Play%20Store-green?logo=google-play)](https://play.google.com/store/apps/details?id=dev.alithiel31.qcweather)

Weather forecast app for Quebec: **Express / TypeScript** backend + **Svelte 5 (PWA)** frontend.
Data provided by [Open-Meteo](https://open-meteo.com) — free, no API key.

---

## Features

| Feature | Detail |
|---|---|
| 🌡️ Current conditions | Temperature, feels-like, wind, humidity |
| 🕐 Hourly forecast | Hour by hour over 48 h |
| 📅 Daily forecast | 7 days with min–max bars and sunrise/sunset times |
| 🛰️ Animated map | Cloud satellite (infrared) + precipitation radar via RainViewer + Leaflet |
| 📮 Postal code search | Geocoding of the Quebec FSA (G, H, J) via Zippopotam |
| 🏙️ City selection | 6 cities available (Montréal, Québec, Gatineau, Sherbrooke, Trois-Rivières, Saguenay), choice remembered across sessions |
| 🌅 Dynamic sky | Background gradient based on conditions and day/night |
| 📱 Installable PWA | Works offline — latest forecast cached |
| ⚡ Server-side cache | Configurable via `.env` to limit calls to Open-Meteo |

---

## Deployment (Docker)

This is the recommended method. `docker-compose.yml` starts the backend (port **3005**) and the Nginx frontend (port **80**).

**1. Configure the environment**

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your own Tailscale IP if needed
```

**2. Run**

```bash
docker compose up --build -d
```

Nginx sets the security headers on the served document — CSP, `X-Content-Type-Options`,
`Referrer-Policy`, `Permissions-Policy`, HSTS. `helmet` only covers the JSON responses of
`/api/`: the HTML that actually runs the JavaScript is served by nginx, not Express.

> **Before editing `frontend/nginx.conf`** — `add_header` does not merge: a `location` block
> that declares even one loses **all** of those inherited from `server`. Security headers are
> therefore set only once, and the cache policy relies on `expires`, which doesn't have this
> effect. The CI's `docker` job checks that `assetlinks.json` still carries its CSP.

The app runs on a **Raspberry Pi** and is exposed publicly through a **Cloudflare tunnel** (no port to open on the router).
Nginx acts as a reverse proxy inside the frontend container: it serves static files and forwards `/api/` calls to the backend.
The Cloudflare tunnel handles **HTTPS** and the `qcweather.alithiel31.dev` domain name — no certificate to manage manually.

---

## Android (TWA)

The app is published on the **Google Play Store** as a TWA (Trusted Web Activity): a thin Android shell that loads the PWA directly from `https://qcweather.alithiel31.dev`.

**Package ID:** `dev.alithiel31.qcweather` — Sources: `twa-qcweather/`

### CI/CD workflows

| Workflow | Trigger | Role |
|---|---|---|
| `build-twa.yml` | Push to `twa-qcweather/**` **from `main`**, or manual **from `main`** | Build + sign the `.aab` |
| `deploy-twa.yml` | After `build-twa.yml` succeeds, or manual from `main` | Publish to Play Store (Internal Testing) |

> The production keystore is only decrypted from `main` — both workflows carry the
> `github.ref == 'refs/heads/main'` guard, which also covers manual dispatch.
>
> **A TWA change therefore cannot be built before it's merged.** To validate it beforehand:
> `cd twa-qcweather && ./gradlew bundleRelease` locally, with a development keystore.
> The production signature only exists on `main`.

> `deploy-twa.yml` requires a **first manual submission** in Play Console — Google requires a version to already exist on the track before accepting uploads via API.

### Required GitHub secrets

| Secret | Description |
|---|---|
| `KEYSTORE_BASE64` | Android keystore, base64-encoded |
| `KEYSTORE_PASSWORD` | Keystore password |
| `KEY_PASSWORD` | Signing key password |
| `PLAY_SERVICE_ACCOUNT_JSON` | Google Play API Service Account JSON key |

### Setting up the Service Account (once)

1. [Google Cloud Console](https://console.cloud.google.com) → IAM & Admin → Service Accounts → Create
2. Download the JSON key → add it as the `PLAY_SERVICE_ACCOUNT_JSON` secret
3. Play Console → Setup → API access → link the service account → **Release Manager** role

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | ❌ | `3005` | Backend port |
| `NODE_ENV` | ❌ | `development` | Environment (`production` in prod) |
| `TAILSCALE_IP` | ❌ | — | Tailscale IP for remote network access |
| `PUBLIC_ORIGINS` | ❌ | — | CORS origins allowed in addition to the local machine and Tailscale, comma-separated |
| `FETCH_TIMEOUT_MS` | ❌ | `5000` | Max delay of a call to Open-Meteo / Zippopotam |
| `TRUST_PROXY_HOPS` | ❌ | `2` | Number of proxies in front of the API (cloudflared + nginx) |
| `RATE_LIMIT_WINDOW_MS` | ❌ | `60000` | Rate limiting window |
| `RATE_LIMIT_MAX` | ❌ | `100` | Requests/window/IP on `/api` |
| `RATE_LIMIT_GEOCODE_MAX` | ❌ | `20` | Requests/window/IP on `/api/geocode` |
| `CACHE_TTL_PREVISIONS` | ❌ | `600000` | Weather cache duration in ms (default: 10 min) |
| `CACHE_TTL_GEOCODE` | ❌ | `2592000000` | Geocoding cache duration in ms (default: 30 days) |
| `CACHE_TTL_RAINVIEWER` | ❌ | `300000` | RainViewer index cache duration in ms (default: 5 min) |
| `CACHE_MAX_ENTRIES` | ❌ | `500` | Cache entry cap (LRU eviction) |
| `CACHE_FACTEUR_OBSOLETE` | ❌ | `6` | An entry stays servable `factor × TTL` past expiry if the upstream fails |
| `BREAKER_SEUIL_ECHECS` | ❌ | `5` | Consecutive failures before suspending calls to an upstream |
| `BREAKER_REPOS_MS` | ❌ | `30000` | Suspension duration before the test request |
| `DEFAULT_TIMEZONE` | ❌ | `America/Toronto` | Timezone for Open-Meteo forecasts |

---

## Local development

### Backend (port 3005)

```bash
cd backend && npm install
npm run dev        # auto-reload (tsx --watch)
```

Available routes:

| Route | Description |
|---|---|
| `GET /api/villes` | List of available cities |
| `GET /api/previsions/:ville` | Forecast by city (`montreal`, `quebec`, `gatineau`, `sherbrooke`, `trois-rivieres`, `saguenay`) |
| `GET /api/previsions-coordonnees?lat=&lon=&nom=` | Forecast for a GPS point |
| `GET /api/geocode/:codePostal` | Geocodes a Quebec FSA (e.g. `H2X`) |
| `GET /api/rainviewer` | Index of satellite and radar images for the animated map |
| `GET /api/sante` | Service health check |

Calls to external APIs are bounded by `FETCH_TIMEOUT_MS` and retried once on network error or
5xx. An upstream that doesn't respond in time returns a **504**, an upstream in error a
**502** — never a hung request.

All three upstreams go through this same path, RainViewer included: its index used to go
directly from the browser to `api.rainviewer.com`, with no cache and no quota. Only the
**index** is proxied — tiles are still loaded directly from `tilecache.rainviewer.com`, routing
them through the Raspberry Pi would cost far more than what the cache would save. In exchange,
the map now depends on the backend: if it's unreachable, it shows its fallback message instead
of fending for itself.

Allowed CORS origins are the development machine, the Tailscale IP if configured, and those
declared by `PUBLIC_ORIGINS`. In production, nginx proxies `/api/` same-origin: no request
carries an `Origin` header, so a public domain missing from the list shows up on no real
request — until the day a client is served from another host.

The API is publicly exposed: hardening headers (`helmet`), JSON body capped at 10 KB, and rate
limiting per client IP (**429** past the quota). `/api/sante` is never rate-limited — the
Docker healthcheck polls it every 30 s.

External API responses are validated before use: a schema drift at Open-Meteo or Zippopotam
returns a **502** naming the faulty field, never a 500. All errors share the same envelope
`{ status, error }`, to which validation errors add `details`.

Every response carries an `X-Request-Id` header — passed through from the upstream if
provided — that shows up in the logs. A user reporting an outage can quote this ID:

```bash
docker compose logs backend | grep <id>
```

Every completed request produces a log line — method, path, status, duration, and response
origin (`frais` (fresh), `obsolete` (stale), `amont` (upstream)) — and every upstream call its
own, with its latency. That's what lets you tell "it's Open-Meteo" from "it's the Pi" without
instrumenting anything. Rate limiter rejections, which never reach the error handler, show up
as `warn` with their 429.

`GET /api/sante` rounds out the picture: Node version, uptime, resident memory, cache
statistics (entries, hits, misses, rate) and upstream circuit breaker state.

### Upstream resilience

Three mechanisms, all visible in `/api/sante`:

- **Request coalescing** — N concurrent requests on a cold key trigger only one upstream call.
  Since the TTL is fixed, all warm keys expire together: without this, the burst following an
  expiry would go to the provider in full.
- **Degraded service** — a stale entry stays servable for `CACHE_FACTEUR_OBSOLETE × TTL`, but
  only if the upstream just failed. The response then carries `obsolete: true`, which the app
  displays: a twenty-minute-old forecast beats an error screen. On the service worker side, a
  Workbox plugin treats a 5xx as a network failure — otherwise `NetworkFirst` would never fall
  back to the cache, a 502 being a *resolved* response.
- **Circuit breaker** — past `BREAKER_SEUIL_ECHECS` consecutive failures, calls to that
  upstream are suspended for `BREAKER_REPOS_MS` and respond **503** immediately, then a single
  request tests whether the service is back. Without it, a dead upstream would tie up ~10 s of
  connection per request, multiplied by the number of clients — on a Pi capped at 256 MB, a
  third-party outage became a local resource exhaustion.

An invalid environment variable (`PORT=abc`, empty quota) fails startup while naming it,
instead of letting the server run with a `NaN`.

> **Calibrating `TRUST_PROXY_HOPS`** — rate limiting applies per client IP. Behind cloudflared
> then nginx, you need to walk back 2 hops to recover the real client; misconfigured, all
> visitors share the same counter. After an infrastructure change, verify with
> `curl -s https://qcweather.alithiel31.dev/api/villes -D - | grep -i ratelimit` from two
> different networks: the counters must be independent.

### Tests (backend)

| Command | Scope | Network |
|---|---|---|
| `npm run test:run` | Unit + integration — run by the `pre-push` hook | ❌ no network call |
| `npm run test:unit` | Unit only | ❌ no network call |
| `npm run test:coverage` | Same + coverage report — **this is what CI runs** | ❌ no network call |
| `npm run test:contract` | Verifies the real contract of Open-Meteo, Zippopotam and RainViewer | ✅ real calls |

Integration tests rely on the fixtures in `backend/tests/fixtures/`: an external API outage can
no longer fail a PR. `tests/setup.ts` explicitly fails any unmocked network call.

Contract tests run separately via the `contract.yml` workflow (nightly + manual): this is what
detects a schema drift at the external APIs. On failure it **opens an issue** labeled
`derive-contrat`, and reuses it while it stays open — a detection nobody reads isn't a
detection.

The CI's `docker` job no longer just builds the images: it starts the stack with
`docker compose up --wait` — which exercises the backend healthcheck, the frontend's
`depends_on: service_healthy`, and the nginx configuration on its real network — then queries
`/api/sante`, `/api/villes`, and the app shell through nginx. An invalid environment variable,
a broken healthcheck, or a faulty nginx config now fail in CI rather than at deployment.

> An isolated `nginx -t` in a container doesn't work here: `proxy_pass http://backend:3005`
> requires resolving the `backend` host, which only exists inside the compose network. The
> real startup is what serves as the test.

`test:coverage` fails below the thresholds declared in `backend/vitest.config.ts`. They're set
**below the actual measurement**, not a round number: they block an outright regression
without breaking CI as soon as a refactor adds a hard-to-reach guard. `app.ts` is excluded from
the measurement — it only contains `listen()` and the signal handlers, whose real verification
is the Docker healthcheck.

### Frontend (port 5173)

```bash
cd frontend && npm install
npm run dev
```

Open `http://localhost:5173`. The Vite proxy forwards `/api` to the backend.

All network calls go through `src/lib/api.ts` — the only place `fetch` is called on the
frontend, which lets it be stubbed in one block in tests.

### Tests (frontend)

| Command | Scope |
|---|---|
| `npm run test` | Watch mode during development |
| `npm run test:run` | A single full pass |
| `npm run test:coverage` | Same + coverage report |
| `npm run test:ci` | Same + `rapport-tests.json` — **this is what CI runs** |
| `npm run test:pwa` | PWA checks only (manifest + service worker) |
| `npm run test:e2e` | End-to-end run in Chromium (Playwright) |

CI publishes `frontend/coverage/` and `frontend/rapport-tests.json` as an artifact
(`frontend-rapports`, kept 14 days), including when the job fails — that's when the report is
most useful.

`jsdom` environment + Testing Library. As on the backend, `tests/setup.ts` explicitly fails any
unmocked network call: a test can't depend on the backend or RainViewer being available.

Coverage thresholds live in `frontend/vitest.config.ts`, set below the actual measurement.
`src/main.ts` is excluded from it: it only mounts the app and registers the service worker.

### End-to-end

`e2e/` opens the **built** app in Chromium via Playwright: city selection and persistence of
the choice, postal code search, backend error message, "Retry" button, offline toggle, startup
with corrupted storage.

The API is doubled by Playwright rather than served by the real backend. An end-to-end suite
that depends on Open-Meteo would become exactly what `tests/setup.ts` forbids everywhere else:
a test that fails for a reason unrelated to the code. The service worker is neutralized for the
same reason — it would intercept requests before the doubles, and its guarantees are already
verified on the build output by `tests/pwa/build.test.ts`.

```bash
cd frontend && npm run test:e2e
```

> An environment that already provides Chromium can point to it via
> `PLAYWRIGHT_CHROMIUM_PATH` instead of downloading a second one, often of a version
> incompatible with what Playwright expects.

### PWA checks

`tests/pwa/build.test.ts` rebuilds the app and reads the `dist/` output to verify the two
promises advertised above — installability and offline operation:

- the manifest declares `display: standalone`, a `start_url`, the 192/512 icons and a
  `maskable` icon, and only references files that actually exist;
- the service worker is generated, registered by the bundle, and precaches the app shell;
- the expected caching strategies are wired up correctly (`NetworkFirst` on
  `/api/previsions`, `CacheFirst` on background tiles).

```bash
cd frontend && npm run test:pwa
```

> **Why not Lighthouse** — since Lighthouse 12, the PWA category and its audits
> (`installable-manifest`, `service-worker`) have been **removed**; Lighthouse 13 only knows
> `performance`, `accessibility`, `best-practices` and `seo`. Auditing installability would
> require pinning an abandoned version, plus headless Chrome and a static server in CI. The
> same guarantees can be read from the build output, in a few seconds and without a browser.

---

## Structure

```
meteo-qc/
├── docker-compose.yml
├── backend/
│   ├── app.ts                        # Entry point (startup, graceful shutdown)
│   ├── .env.example                  # Environment variables template
│   └── src/
│       ├── index.ts                  # Builds the Express app
│       ├── config.ts                 # Validated environment variables (Zod)
│       ├── data/cities.ts            # Cities and coordinates
│       ├── routers/                  # Route definitions
│       ├── controllers/              # Request logic
│       ├── services/                 # Open-Meteo, geocoding, RainViewer, cache
│       ├── middlewares/              # Errors, rate-limit, request-id, access log
│       ├── schemas/                  # Zod validation of upstream responses
│       └── lib/                      # Circuit breaker, errors, log, HTTP requests
└── frontend/
    ├── src/
    │   ├── main.ts                        # App mount + service worker
    │   ├── App.svelte                     # Active city, dynamic sky
    │   └── lib/
    │       ├── Horaire.svelte             # 48 h hourly strip
    │       ├── CarteNuages.svelte         # Animated Leaflet map
    │       ├── Quotidien.svelte           # 7-day forecast
    │       ├── ConditionsActuelles.svelte # Temperature, feels-like, wind, humidity
    │       ├── RechercheCodePostal.svelte # Postal code search
    │       ├── animationFrames.svelte.ts  # Map animation state machine
    │       ├── preferences.svelte.ts      # Remembered city and preferences
    │       ├── stockage.ts                # Failure-tolerant localStorage access
    │       ├── api.ts                     # Backend and RainViewer calls
    │       ├── meteo.ts                   # WMO codes → labels, icons
    │       └── types.ts                   # TypeScript interfaces
    └── tests/
        ├── unit/                   # meteo.ts, api.ts
        ├── composants/             # Svelte rendering (Testing Library)
        ├── pwa/                    # Installable manifest + service worker
        └── helpers/                # Fetch stubs
```

---

## Adding a city

Add an entry to `backend/src/data/cities.ts`.

---

## Notes

**Postal code precision** — the app uses the FSA (first 3 characters, e.g. `H2X`) rather than the full postal code, which localizes to roughly the neighborhood — enough for weather model resolution (a few kilometers).

---

## Stack

| Layer | Technology |
|---|---|
| Backend | Express 5 · Node.js 22+ · TypeScript 5.6 |
| Frontend | Svelte 5 · TypeScript · Vite 8 |
| PWA | vite-plugin-pwa · Service Worker (network-first) |
| Map | Leaflet · RainViewer |
| Infra | Docker · Nginx |
| Network access | Tailscale |
| External APIs | Open-Meteo · Zippopotam.us · CARTO / OpenStreetMap |
| Android | TWA · Bubblewrap · Google Play Store |
| CI/CD | GitHub Actions (`ci.yml` · `build-twa.yml` · `deploy-twa.yml`) |

## Contributing

Development environment, reproducing CI locally, commit convention: see [CONTRIBUTING.en.md](./CONTRIBUTING.en.md).

## Troubleshooting

Known cases (nginx config, network calibration, CI): see [TROUBLESHOOTING.en.md](./TROUBLESHOOTING.en.md).

## License

MIT — see [LICENSE](./LICENSE)
