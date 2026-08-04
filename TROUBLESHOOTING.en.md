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
