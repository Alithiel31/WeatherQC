# Local development

🇫🇷 [Version française](./developpement.md)

[Back to README](../README.en.md)

## Backend (port 3005)

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
| `GET /api/geocode-ville/:nom` | Geocodes a Quebec city by name |
| `GET /api/rainviewer` | Index of satellite and radar images for the animated map |
| `GET /api/sante` | Service health check |
| `GET /api/openapi.json` | OpenAPI 3.1 document for the API |
| `GET /api/notifications/cle-publique` | Public VAPID key, needed by the browser to subscribe to weather alerts |
| `POST /api/notifications/abonnement` | Registers the browser's `PushManager` subscription for a city |
| `DELETE /api/notifications/abonnement` | Removes a subscription (idempotent) |

`openapi.json` is generated at startup from the same Zod schemas that actually validate
requests (`backend/src/schemas/validation.ts`) — not a hand-written spec that drifts from the
code. Response bodies don't have that guarantee: the backend doesn't validate its own output,
so `backend/src/schemas/openapi-reponses.ts` describes them separately for documentation
purposes only. To explore it: paste the URL into [Swagger Editor](https://editor.swagger.io) or
import it into Postman/Insomnia — nothing is served as HTML by the backend, to avoid loosening
the CSP set by nginx.

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
docker compose --env-file frontend/.env logs backend | grep <id>
```

Every completed request produces a log line — method, path, status, duration, and response
origin (`frais` (fresh), `obsolete` (stale), `amont` (upstream)) — and every upstream call its
own, with its latency. That's what lets you tell "it's Open-Meteo" from "it's the Pi" without
instrumenting anything. Rate limiter rejections, which never reach the error handler, show up
as `warn` with their 429.

`GET /api/sante` rounds out the picture: Node version, uptime, resident memory, cache
statistics (entries, hits, misses, rate) and upstream circuit breaker state.

Network resilience mechanisms (request coalescing, degraded service, circuit breaker): see
[Upstream resilience](./architecture.en.md#upstream-resilience).

## Tests (backend)

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

## Frontend (port 5173)

```bash
cd frontend && npm install
npm run dev
```

Open `http://localhost:5173`. The Vite proxy forwards `/api` to the backend.

All network calls go through `src/lib/api.ts` — the only place `fetch` is called on the
frontend, which lets it be stubbed in one block in tests.

## Tests (frontend)

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

## End-to-end

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

## PWA checks

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
