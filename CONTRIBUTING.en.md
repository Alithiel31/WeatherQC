# Contributing

🇫🇷 [Version française](./CONTRIBUTING.md) — this is the canonical version of this document.

Thanks for your interest in this project. QcWeather is a weather forecast app (Express/TypeScript API + Svelte 5 PWA); any contribution that fixes a bug, improves accessibility or resilience, or completes the documentation is welcome.

## Before you start

- Open an issue to discuss the change you have in mind, except for trivial fixes (typo, broken link).
- Check that the change isn't already in progress in the `[Non publié]` (Unreleased) section of [`CHANGELOG.md`](./CHANGELOG.md).

## Development environment

```bash
git clone git@github.com:Alithiel31/WeatherQC.git
cd WeatherQC

cd backend
npm install
cp .env.example .env
# edit .env if needed (Tailscale IP, public origins...)

cd ../frontend
npm install
```

Run both in parallel (two terminals):

```bash
cd backend && npm run dev    # http://localhost:3005
cd frontend && npm run dev   # http://localhost:5173, proxies /api to the backend
```

## Reproducing CI locally

### Backend (`backend` job in `ci.yml`)

```bash
cd backend
npm run format:check
npm run lint
npm run test:coverage   # fails below the thresholds in vitest.config.ts
npm run build
npm audit --audit-level=high --omit=dev
```

### Frontend (`frontend` job in `ci.yml`)

```bash
cd frontend
npm run format:check
npm run lint
npm run check             # svelte-check
npm run test:ci           # includes PWA tests + coverage
npm run build
npm audit --audit-level=high --omit=dev
```

### End-to-end (`e2e` job)

```bash
cd frontend
npx playwright install --with-deps chromium
npm run test:e2e   # builds then serves dist/, tests the actually deployed bundle
```

### Docker (`docker` job)

Starts the real stack (healthchecks, nginx, security headers, compression, caching) — reproduce this before touching `docker-compose.yml`, `frontend/nginx.conf`, or a `Dockerfile`:

```bash
cp backend/.env.example backend/.env
docker compose up -d --wait --wait-timeout 120
curl -fsS localhost/api/sante
curl -fsSI localhost/ | grep -i content-security-policy
docker compose down -v
```

### External API contracts

`npm run test:contract` (backend) makes real calls to Open-Meteo, Zippopotam and RainViewer — outside the PR path, it runs nightly via `contract.yml`. Only run it when you doubt an upstream schema (see [TROUBLESHOOTING.en.md](./TROUBLESHOOTING.en.md)).

## Pre-push hook

A Husky hook (`.husky/pre-push`) replays format, lint and `test:run` on the backend, then format, lint, `svelte-check` and `test:run` on the frontend before every push. It installs automatically via `npm install` at the repo root (`prepare: husky`).

## Opening a Pull Request

1. Create a branch from `main` (`git checkout -b fix/my-change`).
2. Commit with a clear message, ideally in the `type: description` format (`fix:`, `docs:`, `chore:`...).
3. Update [`CHANGELOG.md`](./CHANGELOG.md) in the `[Non publié]` (Unreleased) section, with the right category (`Added`, `Changed`, `Fixed`, `Security`, `Accessibility`) if the change is notable for a user or an operator.
4. Check that the `backend`, `frontend`, `e2e` and `docker` jobs pass.
5. Open the PR against `main`.

## Adding a city

Add an entry to `backend/src/data/cities.ts` (id, name, latitude, longitude, timezone). The list exposed by `GET /api/villes` and the frontend's offline fallback derive from it automatically.

## Reporting a problem

Open an issue from the repository's Issues tab — the bug report form asks for the affected city, the API endpoint, and, if possible, the `X-Request-Id` header of the failing response (visible in the logs: `docker compose logs backend | grep <id>`). Check [TROUBLESHOOTING.en.md](./TROUBLESHOOTING.en.md) first — cases already encountered are documented there.

## Secrets

Never commit `backend/.env`, a real Tailscale IP, or the Android secrets (`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON`). `npm audit` runs in CI on both packages' production dependencies.
