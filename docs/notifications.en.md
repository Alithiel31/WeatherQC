# Weather alerts (notifications)

🇫🇷 [Version française](./notifications.md)

[Back to README](../README.en.md)

Optional, per-city subscription to Web Push alerts triggered by a sudden weather change —
imminent precipitation, temperature drop, strong wind, freezing rain, thunderstorm. Routes are
listed in the routes table of [Local development](./developpement.en.md#backend-port-3005)
(`GET /api/notifications/cle-publique`, `POST`/`DELETE /api/notifications/abonnement`).

```bash
# backend/.env — generate a VAPID key pair (once)
npx web-push generate-vapid-keys
```

Without `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` configured (see
[Environment variables](./environnement.en.md)), the `/api/notifications/*` routes return **503**
and the "Turn on weather alerts" control in the UI fails cleanly on subscription rather than
taking down the rest of the application.

**Detection** (`backend/src/services/detecteur-alertes.ts`) — a pure function, no network or
clock: compares the current state to the hourly forecast and returns the alerts that cross a
threshold (precipitation ≥ 70% within 2 h, drop ≥ 8 °C within 6 h, gusts ≥ 60 km/h, freezing rain
and thunderstorm by WMO code). Freezing rain and thunderstorm are flagged "important".

**Subscriptions** (`backend/src/services/abonnements.service.ts`) — `node:sqlite` storage, a
single file by default (`DB_PATH`), a subscriptions table (city, endpoint, encryption keys) and
an anti-spam table that stops the same alert from being resent while the situation that triggered
it hasn't stopped and recurred. A browser only ever carries one active subscription: re-subscribing
the same `endpoint` to another city replaces the existing entry instead of creating a second one.

**Checking and sending** (`backend/src/services/verificateur-alertes.ts`) — an hourly cycle,
limited to cities with at least one subscription (`villesAbonnees()`, to avoid querying
Open-Meteo for the rest). A subscription whose delivery fails with a 404/410 Web Push error is
considered expired and deleted automatically — that's how orphaned subscriptions (permission
revoked, app uninstalled) get cleaned up, with no explicit action from anyone.

**Frontend** — `frontend/src/lib/notifications.ts` (permission request, `PushManager`
subscribe/unsubscribe) and `AlertesMeteo.svelte` (the control shown below the app header, hidden
rather than shown as an error when the browser doesn't support Push — Safari iOS < 16.4, private
browsing in several browsers). Receiving the push lives in the service worker
(`frontend/src/sw.ts`, vite-plugin-pwa's `injectManifest` mode — the only way to add `push`/
`notificationclick` handlers, which `generateSW` doesn't allow), which shows the notification and
focuses the first open tab on click.

What the browser sends and what the server keeps: see the "Weather alerts (notifications)"
section of the
[privacy policy](https://qcweather.alithiel31.dev/privacy-policy.en.html).
