# Third-party API watch

🇫🇷 [Version française](./veille-api-tierces.md)

[Back to README](../README.en.md)

The backend and frontend rely on five external services that are **free, with no formal
contract or SLA**. A provider can change its terms, quota, or response format without notice —
it already happened: the CARTO base map has shown an "API KEY REQUIRED" watermark since late
August 2026, with no advance notice spotted before the app displayed it in production (see
`frontend/.env.example` and [docs/environnement.en.md](./environnement.en.md)).

This page centralizes what to watch, where, and how often.

---

## Providers to watch

| Provider | Used for | Page to watch | Automatically detected? |
|---|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Hourly/daily forecasts, no API key | [Terms of use](https://open-meteo.com/en/terms) · [Pricing](https://open-meteo.com/en/pricing) | ✅ `contract.yml` (nightly) |
| [Zippopotam.us](https://www.zippopotam.us) | Postal code geocoding (Quebec FSA) | [Home page](https://www.zippopotam.us) (no dedicated ToS page known — check service availability and response format stability) | ✅ `contract.yml` (nightly) |
| [RainViewer](https://www.rainviewer.com) | Precipitation radar tiles | [API documentation](https://www.rainviewer.com/api.html) | ✅ `contract.yml` (nightly) |
| [OpenWeatherMap](https://openweathermap.org) | Cloud cover fallback when RainViewer has no satellite image | [Pricing](https://openweathermap.org/price) · [Terms](https://openweathermap.org/terms) | ❌ no contract test |
| [CARTO](https://carto.com) | Base map on the "Clouds" tab (`VITE_CARTO_API_KEY`) | [Legal notices](https://carto.com/legal/) · [API key page](https://carto.com/basemaps/apikey/) | ❌ no contract test |

`contract.yml` (see [docs/developpement.en.md](./developpement.en.md)) hits the real APIs every
night and automatically opens a `derive-contrat` issue on schema drift — but only for
Open-Meteo, Zippopotam, and RainViewer. **OpenWeatherMap and CARTO have no automated safety
net**: a change from either provider (a key becoming mandatory, a reduced quota, a pricing
change introduced) will only surface through a manual check, or by discovering it in production
the way the CARTO watermark was.

---

## What to check on each pass

For each of the five providers:

1. **Does the service still respond without a key / on the current free plan?** (test a real
   request if in doubt, rather than trusting documentation alone)
2. **Has the free quota changed?** (requests/day, per-IP limiting...)
3. **Has the response format visibly changed?** (new fields, renamed fields, different errors)
   — especially for OpenWeatherMap and CARTO, which `contract.yml` doesn't cover
4. **Has an API key become mandatory, or has a watermark/degradation appeared** (the CARTO case
   from August 2026)?
5. **Has the provider announced a deprecation, acquisition, or ownership change?**

---

## Recommended frequency

- **Open-Meteo, Zippopotam, RainViewer**: covered by `contract.yml` — reading the
  `derive-contrat` issue (if one exists) is enough, no periodic manual check needed.
- **OpenWeatherMap and CARTO**: manual check every **quarter**, or immediately after any visible
  anomaly in production (watermark, missing tiles, unexpected 401/403 error).

---

## Check log

To be filled in on every pass over OpenWeatherMap and/or CARTO (the other three providers are
covered by `contract.yml`, no need to log them here).

| Date | Provider | Result | Action taken |
|---|---|---|---|
| 2026-09 (found in production) | CARTO | "API KEY REQUIRED" watermark appeared on the base map with no advance notice spotted | Documented in `frontend/.env.example` and the README; `VITE_CARTO_API_KEY` recommended |

---

## If drift is found

- **Open-Meteo / Zippopotam / RainViewer**: see the automatically opened `derive-contrat` issue,
  fix the relevant Zod schema in `backend/src/schemas/`.
- **OpenWeatherMap / CARTO**: update this document (table above), then assess whether the
  existing fallback (unavailability message, visible watermark) is still acceptable or whether
  switching providers becomes necessary.
