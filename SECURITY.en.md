# Security

🇫🇷 [Version française](./SECURITY.md) — this is the canonical version of this document.

## Reporting a vulnerability

Please **do not** open a public issue for a security flaw — a regular GitHub issue exposes it to
everyone before a fix exists.

Two ways to report, in order of preference:

1. **[Report a vulnerability](https://github.com/Alithiel31/WeatherQC/security/advisories/new)**
   via the repository's Security tab (GitHub Security Advisories) — the report stays private
   between you and the maintainer, and allows for coordinated disclosure once a fix is published.
2. By email to [contact@alithiel31.dev](mailto:contact@alithiel31.dev), with `SECURITY` in the
   subject line, and if possible: the affected component (backend, frontend, `twa-qcweather/`,
   CI), reproduction steps, and the expected impact.

### What we can promise

- Acknowledgment within **72 hours**.
- This project is maintained by a single person, in their spare time: no formal SLA beyond the
  acknowledgment, but a confirmed flaw with real impact jumps the queue.
- Credit in [`CHANGELOG.md`](./CHANGELOG.md) once the fix ships, unless you'd rather stay
  anonymous.
- No bug bounty program — this is a personal project, not a company.

## Scope

In scope:

- The Express backend (`backend/`) and its direct dependencies.
- The Svelte/PWA frontend (`frontend/`) and its direct dependencies.
- The Docker/nginx configuration (`docker-compose.yml`, `frontend/nginx.conf`, the `Dockerfile`s).
- The GitHub Actions workflows (`.github/workflows/`) — particularly the ones handling the
  Android keystore and the Play Store service account.
- The Android TWA shell (`twa-qcweather/`).

Out of scope:

- The third-party APIs consumed (Open-Meteo, Zippopotam, RainViewer, OpenWeatherMap, CARTO) —
  report those directly to their own teams.
- A flaw requiring physical access to the Raspberry Pi hosting the service, or already
  privileged access to the infrastructure (Tailscale, Cloudflare tunnel).
- Pure volumetric denial of service: the rate limiting documented in the
  [README](./README.en.md) is a mitigation, not a guarantee of absorbing hostile mass traffic —
  an endpoint that bypasses it, however, is in scope.
- Social engineering targeting the maintainer or third parties.

## What's already in place

Before reporting something already covered, a few existing mechanisms (detailed in the
[README](./README.en.md)):

- **Dependencies** — `npm audit --audit-level=high` blocks CI on production dependencies;
  Dependabot opens a weekly PR per ecosystem (npm, Docker, Gradle, GitHub Actions).
- **Secrets** — the `secrets.yml` workflow (gitleaks) scans the full history on every push, every
  PR, and weekly.
- **Input** — every request parameter is validated with Zod
  (`backend/src/schemas/validation.ts`); every upstream API response is too
  (`backend/src/schemas/*.schema.ts`) — an external contract drift returns a 502, never
  processing of unvalidated data.
- **Headers** — `helmet` on the API side, CSP/HSTS/`X-Content-Type-Options` set by nginx on the
  HTML document side (see `frontend/nginx.conf`).
- **Base images** — the Docker images (`node:*-alpine`, `nginx:alpine`) are updated weekly via
  Dependabot, and `apk update && apk upgrade` runs on every build to pick up a patch published
  between two tags.

## Supported versions

A single deployment, no version branches: only the code on `main` — the one actually running in
production at `qcweather.alithiel31.dev` — receives security fixes.
