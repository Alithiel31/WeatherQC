# Handover guide

🇫🇷 [Version française](./guide-de-reprise.md)

[Back to README](../README.en.md)

Météo Québec has a single real maintainer (**Jacques Duchamplecheval**, GitHub handle
`Alithiel31`). This document exists so that another person — or Jacques himself after a long
break — can pick the project back up without having to rebuild alone what is documented
elsewhere, scattered, or known only to the maintainer. It points to existing documentation
rather than duplicating it, and lists what one needs *access to* in order to act, not just to
*understand*.

---

## 1. Understanding the project — recommended reading order

1. [README.en.md](../README.en.md) — overview, features, stack
2. [docs/architecture.en.md](./architecture.en.md) — full diagram, upstream resilience, repository structure
3. [docs/environnement.en.md](./environnement.en.md) — every config variable
4. [docs/developpement.en.md](./developpement.en.md) — running the project locally, tests, CI
5. [docs/android.en.md](./android.en.md) — TWA / Google Play pipeline
6. [docs/notifications.en.md](./notifications.en.md) — weather push alerts
7. [docs/veille-api-tierces.en.md](./veille-api-tierces.en.md) — dependency on free APIs
8. [CONTRIBUTING.en.md](../CONTRIBUTING.en.md), [SECURITY.en.md](../SECURITY.en.md), [TROUBLESHOOTING.en.md](../TROUBLESHOOTING.en.md)
9. [CHANGELOG.md](../CHANGELOG.md) — detailed history of decisions

---

## 2. What's running, and where

| Component | Where | How to access it |
|---|---|---|
| Production app | `qcweather.alithiel31.dev` | Public domain, HTTPS via Cloudflare tunnel |
| Hosting | A physical **Raspberry Pi** (hostname `Caesura` in scripts/CI) | Network access via **Tailscale** — see `TAILSCALE_IP` in [docs/environnement.en.md](./environnement.en.md) |
| Containers | `docker-compose.yml` at the repo root (backend + frontend nginx) | `docker compose ps` on the Pi |
| Continuous deployment | Workflow `.github/workflows/deploy-web.yml` | Triggers on push to `main`, or via `npm run deploy:web` (see `scripts/gh-deploy.sh`) — runs on a **GitHub Actions self-hosted runner installed on the Pi itself** (the Pi reaches out for the job, no inbound port to open) |
| Domain name | `alithiel31.dev` | Registrar — **to be filled in by the maintainer** (registrar name, credentials) |
| Cloudflare tunnel | Cloudflare account tied to the domain | **To be filled in** (Cloudflare account credentials) |
| Android app | Package `dev.alithiel31.qcweather`, Google Play internal testing | See [docs/android.en.md](./android.en.md) for the `android.yml` / `build-twa.yml` / `deploy-twa.yml` workflows |

---

## 3. Secrets and access needed to act

No real secret is stored in this repository (see `.gitignore` and
[SECURITY.en.md](../SECURITY.en.md)). To actually take over the project, the following need to
be obtained — **to be filled in by the current maintainer** (password manager used, or any
other secure transmission method):

- **Admin access to the GitHub repository** [`Alithiel31/WeatherQC`](https://github.com/Alithiel31/WeatherQC) (Actions secrets, CODEOWNERS/branch settings)
- **Cloudflare account** (tunnel, `alithiel31.dev` domain)
- **Tailscale account** (network access to the Raspberry Pi)
- **Physical or SSH access to the Raspberry Pi** hosting the containers and the self-hosted runner
- **Real `backend/.env` and `frontend/.env`** (or the values needed to rebuild them from `backend/.env.example` / `frontend/.env.example`) — in particular the VAPID keys (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, regenerable with `npx web-push generate-vapid-keys` but doing so invalidates every existing push subscription), and the OpenWeatherMap / CARTO API keys (free, see [docs/veille-api-tierces.en.md](./veille-api-tierces.en.md))
- **Android signing keystore** (`twa-qcweather/android.keystore`, git-ignored) and its password — without it, a signed update of the same existing app can't be published to the Play Store
- **Google Play Console account** + **service account** used by `deploy-twa.yml` (see [docs/android.en.md](./android.en.md))
- **`contact@alithiel31.dev` mailbox** (fallback security-reporting channel, see [SECURITY.en.md](../SECURITY.en.md))

> Without the Android keystore and its password, the app **cannot** be replaced with a new
> build: Google Play rejects an APK signed by a different key. Its loss is irreversible for the
> existing app listing — the single most critical item on this list.

---

## 4. Bringing the service back up from scratch

If the Raspberry Pi is lost or replaced but the code and the secrets above are available:

1. Reinstall Docker + Docker Compose on the new machine
2. Reconfigure the Cloudflare tunnel and Tailscale to point at this machine
3. Rebuild `backend/.env` and `frontend/.env` (see [docs/environnement.en.md](./environnement.en.md))
4. Reinstall the GitHub Actions self-hosted runner (needed for `deploy-web.yml`) — see GitHub's
   own documentation on self-hosted runners, this repository doesn't duplicate it
5. `docker compose --env-file frontend/.env up --build -d` (see [README.en.md](../README.en.md#deployment-docker))
6. Check `/api/sante` and the security headers (the CI's `docker` job runs the exact same
   checks, see `.github/workflows/ci.yml`)

Without access to the secrets above (VAPID keys, Android keystore), the web service can still
be recreated but with new keys — **every existing weather alert subscription will become
invalid**, and the existing Android app will no longer be able to receive a signed update.

---

## 5. Known risks to keep in mind

- **Single maintainer** — this document reduces the risk but doesn't remove it; consider, over
  time, granting a second trusted person read access to the secrets list above.
- **Dependency on free third-party APIs with no SLA** — see
  [docs/veille-api-tierces.en.md](./veille-api-tierces.en.md).
- **Single hardware point of failure** — hosting depends on a personal Raspberry Pi; no
  redundancy or documented failover plan to another host as of now.
- **Loss of the Android keystore** — irreversible for the already-published app (see section 3).

---

## To be filled in by the maintainer

The following fields are intentionally left blank — they involve personal information or
credentials that don't belong in a public repository:

- [ ] Where the secrets listed in section 3 are stored (password manager, digital vault...) and who else has access
- [ ] Registrar for the `alithiel31.dev` domain and account credentials
- [ ] Trusted person(s) to contact in case of prolonged maintainer unavailability
- [ ] Physical location of the Raspberry Pi and emergency access arrangements
