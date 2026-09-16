# Troubleshooting

🇫🇷 [Version française](./TROUBLESHOOTING.md) — this is the canonical version of this document.

This document gathers the cases already encountered on this project, with the diagnostic process — not just the final fix. Before opening an issue, check whether your symptom matches one of these.

---

## 1. Security headers disappear on a specific route (`assetlinks.json`)

### Symptom

The CSP and other hardening headers are present on the main page, but missing on `/.well-known/assetlinks.json` — which makes Android's Digital Asset Links verification fail, and with it the TWA's URL verification.

### Cause

In nginx, `add_header` does **not merge** with what's inherited: a `location` block that declares even a single `add_header` loses **all** those defined in the parent `server`. `assetlinks.json` and the privacy policy have a dedicated `location` for their `Content-Type`; adding an `add_header` there made the `server`'s security headers disappear on that one route.

### Fix

Set the security headers only once, at the `server` level, and never use `add_header` inside a `location` that should inherit them. For the cache policy, rely on `expires`, which doesn't have this overriding effect.

Before editing `frontend/nginx.conf`, verify the actual effect with:

```bash
curl -fsSI https://qcweather.alithiel31.dev/.well-known/assetlinks.json | grep -i content-security-policy
```

The CI's `docker` job (`.github/workflows/ci.yml`) checks this on every run, including the `Content-Type` duplication that had the same effect — the regression can no longer reach `main` silently.

---

## 2. All visitors share the same request quota

### Symptom

Rate limiting (`RATE_LIMIT_MAX`) seems to trigger well before the expected threshold, or conversely never — as if all requests came from a single IP.

### Cause

Rate limiting applies per client IP, recovered via `X-Forwarded-For`. Behind **cloudflared then nginx**, you need to walk back exactly 2 hops (`TRUST_PROXY_HOPS=2`) to get the client's real IP. Too low a number falls back to an intermediate proxy's IP; too high, to an arbitrary IP from the header — in both cases, all visitors end up sharing the same counter.

### Diagnosis

After any infrastructure change (new proxy, tunnel change), verify from **two different networks** that the counters are actually independent:

```bash
curl -s https://qcweather.alithiel31.dev/api/villes -D - | grep -i ratelimit
```

### Fix

Adjust `TRUST_PROXY_HOPS` to the actual number of proxies in front of the API. The default (`2`) matches the current topology: cloudflared + nginx.

---

## 3. Playwright downloads a second Chromium on every run

### Symptom

`npm run test:e2e` downloads a Chromium even though the environment already provides one — slower, and sometimes a version incompatible with what Playwright expects.

### Cause

Playwright installs its own managed Chromium build by default, regardless of any version already present on the machine or in the CI image.

### Fix

Point to the existing binary via the `PLAYWRIGHT_CHROMIUM_PATH` environment variable instead of letting Playwright download a second one.

---

## 4. A variable added to the schema is missing from `.env.example`

### Symptom

A variable exists in `backend/src/config.ts` (and hence in the README) but a deployment built from `backend/.env.example` runs with its default value without anyone noticing. This actually happened with `CACHE_TTL_RAINVIEWER`.

### Cause

`.env.example` is the only file an operator copies before deploying — not the README. Nothing guaranteed that any variable added to the Zod schema would be reflected there.

### Fix

A dedicated test (`backend/tests/unit/config.test.ts`, the `.env.example couvre le schéma` block) compares the keys of `environnementSchema` against those present in `.env.example`, both ways: a variable missing from the file, or an orphaned variable that no longer exists in the schema, fails CI instead of being discovered in production.

When adding an environment variable, systematically report it in `backend/.env.example` **and** in the README table — the test catches the first omission, not the second.

---

## 5. `contract.yml` opens a `derive-contrat` issue

### Symptom

An issue labeled `derive-contrat` appears automatically, or an endpoint returns a **502** in production naming a specific field (e.g. `hourly.temperature_2m`).

### Cause

Integration tests run against frozen fixtures and can't detect a schema change at Open-Meteo, Zippopotam, or RainViewer. The `contract.yml` workflow queries the real APIs every night; on failure, it opens an issue (or comments on the existing one) rather than just leaving a red check in an Actions tab nobody reads.

### Fix

1. Open the linked run from the issue to see which field changed shape.
2. Align the corresponding schema in `backend/src/schemas/` (`openmeteo.schema.ts`, `zippopotam.schema.ts`, or `rainviewer.schema.ts`).
3. Re-run locally: `cd backend && npm run test:contract` (real network calls).
4. Once the schema is realigned and the workflow is green again, close the issue manually — it will be reused while it stays open, to avoid stacking one per night.
---

## 6. CI deployment stays stuck in `Queued`/`Pending` forever

### Symptom

`npm run deploy:web` (or a push to `main`) does create a run on `deploy-web.yml`, but it stays
`Queued`/`Pending` for hours, sometimes days. `gh run watch` — which `npm run deploy:web` calls
with no timeout — hangs and never returns.

### Cause

GitHub automatically deletes a self-hosted runner's registration once it has stayed disconnected
from the service for too long ("Runner registrations are automatically deleted for runners that
have not connected to the service recently"). The systemd service may still be running just fine
on the Pi; server-side, no runner matches the `[self-hosted, raspberry-pi]` labels the workflow
expects anymore, so the job never finds anyone to pick it up.

### Diagnosis

```bash
# Service state on the Pi (inactive/dead is the smoking gun)
systemctl status 'actions.runner.Alithiel31-WeatherQC*' --no-pager -l

# Raw runner logs — look for "Failed to create a session" /
# "registration has been deleted"
ls -lt ~/actions-runner-qcweather/_diag | head
cat ~/actions-runner-qcweather/_diag/Runner_<date>.log
```

On GitHub: `Settings → Actions → Runners` on the repo shows `There are no runners configured`
if the registration was indeed deleted server-side.

### Fix

1. Generate a fresh token from `Settings → Actions → Runners → New self-hosted runner` (Linux ARM64).
2. On the Pi, inside `~/actions-runner-qcweather`:
   ```bash
   sudo ./svc.sh stop
   ./config.sh remove --token <token>
   # if remove fails silently, clear the local config by hand instead:
   rm -f .runner .credentials .credentials_rsaparams .service
   ./config.sh --url https://github.com/Alithiel31/WeatherQC \
     --token <token> --name Caesura-qcweather --labels raspberry-pi \
     --replace --unattended
   sudo ./svc.sh start
   ```
3. **Watch out**: reconfiguring the runner starts from a clean `_work`. `frontend/.env` and
   `backend/.env` (untracked, never regenerated by CI — `clean: false` preserves them across
   runs but doesn't recreate them) need to be redeposited by hand into
   `_work/WeatherQC/WeatherQC/{frontend,backend}/.env` after any runner reinstall, or the next
   job fails with `couldn't find env file`.
