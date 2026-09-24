# 🌤️ Météo Québec

🇫🇷 [Version française](./README.md) — this is the canonical version of this document.

[![CI](https://github.com/Alithiel31/WeatherQC/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/Alithiel31/WeatherQC/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22+-green?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Svelte](https://img.shields.io/badge/Svelte-5-orange?logo=svelte)](https://svelte.dev/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-blue?logo=docker)](https://www.docker.com/)
[![Deployed](https://img.shields.io/badge/Deployed-qcweather.alithiel31.dev-blue)](https://qcweather.alithiel31.dev)
[![Cloudflare](https://img.shields.io/badge/Tunnel-Cloudflare-orange?logo=cloudflare)](https://www.cloudflare.com/)
[![Android](https://img.shields.io/badge/Android-Internal%20Testing-yellow?logo=google-play)](https://play.google.com/store/apps/details?id=dev.alithiel31.qcweather)

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
| 🔔 Weather alerts | Optional push notifications, per city, on sudden weather changes (precipitation, temperature drop, wind, freezing rain, thunderstorm) — see the dedicated section below |
| ⚡ Server-side cache | Configurable via `.env` to limit calls to Open-Meteo |

---

## Architecture

Express backend acting as a caching proxy in front of Open-Meteo, Zippopotam and RainViewer; Svelte 5 installable PWA frontend; Android TWA shell — all behind nginx and a Cloudflare tunnel, on a Raspberry Pi. The Express backend is the only component that calls the external APIs, never directly from the browser.

Full diagram, upstream resilience (request coalescing, degraded service, circuit breaker) and detailed repository structure: see [docs/architecture.en.md](./docs/architecture.en.md).

---

## Deployment (Docker)

This is the recommended method. `docker-compose.yml` starts the backend (port **3005**) and the Nginx frontend (port **80**).

**1. Configure the environment**

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your own Tailscale IP if needed

cp frontend/.env.example frontend/.env
# Edit frontend/.env with an OpenWeatherMap API key (free) to enable the satellite
# map fallback — leaving it empty just shows an unavailability message instead
# of the cloud cover. This same file also serves as the Vite config for local
# development (`npm run dev` in frontend/) : docker compose reads it via the
# --env-file flag (see the command below).
```

**2. Run**

```bash
docker compose --env-file frontend/.env up --build -d
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

> **Never run `docker compose up` by hand from a dev machine pointed (via a remote Docker
> context) at Caesura for a production deploy.** Docker Compose names the project after the
> local folder the command is run from: a name that differs from the CI's working directory
> (`WeatherQC`) creates a **second container stack**, which then fights the one managed by
> `deploy-web.yml` for port 80 — this actually happened, see
> [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.en.md#6-ci-deployment-stays-stuck-in-queuedpending-forever).
> For production, always go through `npm run deploy:web`; keep manual `docker compose up` for
> local development/testing only.

**Continuous deployment**: `deploy-web.yml` runs on a self-hosted runner installed on the Pi
itself and triggers automatically on every push to `main` touching `backend/`, `frontend/`, or
`docker-compose.yml` (or manually). It replays `docker compose --env-file frontend/.env up -d --build --wait` in place —
the Pi reaches out to GitHub for the job, no inbound port or SSH key to expose. To trigger it and
follow the deployment live from a local machine:

```bash
npm run deploy:web       # or deploy:android for build-twa.yml
```

---

## Android (TWA)

The app is in **internal testing** on the Google Play Store, as a TWA (Trusted Web Activity) that loads the PWA directly from `https://qcweather.alithiel31.dev`. Package ID: `dev.alithiel31.qcweather` — Sources: `twa-qcweather/`.

CI/CD workflows, required GitHub secrets and Google Play Service Account setup: see [docs/android.en.md](./docs/android.en.md).

---

## Environment variables

Backend configuration validated by Zod at startup (`PORT`, caches, rate limiting, circuit breaker, VAPID for push alerts...) and a frontend build variable for map keys.

Full list with default values: see [docs/environnement.en.md](./docs/environnement.en.md).

---

## Local development

```bash
cd backend && npm install && npm run dev    # port 3005
cd frontend && npm install && npm run dev   # port 5173
```

Available routes, network resilience, unit/integration/contract tests, end-to-end tests and PWA checks: see [docs/developpement.en.md](./docs/developpement.en.md).

---

## Weather alerts (notifications)

Optional, per-city subscription to Web Push alerts triggered by a sudden weather change — imminent precipitation, temperature drop, strong wind, freezing rain, thunderstorm.

Detection, subscription storage, the hourly checking cycle, and frontend integration: see [docs/notifications.en.md](./docs/notifications.en.md).

---

## Adding a city

Add an entry to `backend/src/data/cities.ts`.

---

## Notes

**Postal code precision** — the app uses the FSA (first 3 characters, e.g. `H2X`) rather than the full postal code, which localizes to roughly the neighborhood — enough for weather model resolution (a few kilometers).

---

## Privacy and terms

Three static pages, served from `frontend/public/` and linked from the application footer. French is
the official version — the service is offered to the public in Québec — and the English versions are
courtesy translations.

| Document | Français | English |
|---|---|---|
| Privacy policy | [`/privacy-policy.html`](https://qcweather.alithiel31.dev/privacy-policy.html) | [`/privacy-policy.en.html`](https://qcweather.alithiel31.dev/privacy-policy.en.html) |
| Terms of use | [`/terms.html`](https://qcweather.alithiel31.dev/terms.html) | [`/terms.en.html`](https://qcweather.alithiel31.dev/terms.en.html) |
| Legal notice | [`/legal.html`](https://qcweather.alithiel31.dev/legal.html) | [`/legal.en.html`](https://qcweather.alithiel31.dev/legal.en.html) |

> ⚠️ **`privacy-policy.html` must not be renamed.** That exact URL is declared in the Play Console;
> moving it breaks the app listing, and the failure only surfaces at Google's next review.
> `tests/pwa/build.test.ts` and the CI `docker` job both check for it.

These pages depend on no router: they are standalone HTML files that Vite copies into `dist/`, that
nginx serves through its `location /` fallback, and that Workbox precaches — which is what makes
them readable offline. **The precache is not cosmetic**: without it, the service worker's
`navigateFallback` would serve the application shell in their place.

The content describes what the code actually does — `localStorage` keys, third parties called by the
browser *and* by the backend, logs, per-IP rate limiting. Any change to data handling must be
reflected there, and in the Play Console **Data Safety** form, which is maintained in the console
rather than in this repository.

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
| CI/CD | GitHub Actions (`ci.yml` · `android.yml` · `build-twa.yml` · `deploy-twa.yml` · `deploy-web.yml` · `codeql.yml` · `secrets.yml` · `contract.yml`) |

## Further documentation

- [Architecture, resilience and repository structure](./docs/architecture.en.md)
- [Android (TWA)](./docs/android.en.md)
- [Environment variables](./docs/environnement.en.md)
- [Local development](./docs/developpement.en.md)
- [Weather alerts (notifications)](./docs/notifications.en.md)

## Contributing

Development environment, reproducing CI locally, commit convention: see [CONTRIBUTING.en.md](./CONTRIBUTING.en.md).

## Troubleshooting

Known cases (nginx config, network calibration, CI): see [TROUBLESHOOTING.en.md](./TROUBLESHOOTING.en.md).

## Security

To report a vulnerability, see [SECURITY.en.md](./SECURITY.en.md) — no public issues.

## License

MIT — see [LICENSE](./LICENSE)

---

Made by **Jacques Duchamplecheval** ([alithiel31](https://github.com/Alithiel31)) — [alithiel31.dev](https://alithiel31.dev) · [LinkedIn](https://linkedin.com/in/jacques-duchamplecheval) · [contact@alithiel31.dev](mailto:contact@alithiel31.dev)
