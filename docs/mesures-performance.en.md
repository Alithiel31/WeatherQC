# Performance measurements — V2 baseline

🇫🇷 [Version française](./mesures-performance.md)

[Back to README](../README.en.md)

Numeric starting point, taken on `main` (`eb63ed1`) before any V2 change. It is the yardstick
for later work: an optimisation that does not move these numbers is not one.

## How to read these numbers

**Lab** measurements, not a real phone: the production build is served by `vite preview`, the
API is **mocked** (Open-Meteo is unreachable from the measurement environment) and the
RainViewer/CARTO tiles could not load. The real cost of the map is therefore **underestimated**
here. For a reliable figure, run mobile Lighthouse again against the deployed site from a real
device.

## Tests

| | Files | Tests | Statements | Branches | Functions | Lines |
|---|---|---|---|---|---|---|
| Frontend | 19 | 375 | 96.85 % | 91.42 % | 94.82 % | 96.99 % |
| Backend | — | 297 | 99.06 % | 96.19 % | 99.18 % | 99.17 % |

Everything passes and the `vitest.config.ts` thresholds (frontend 94/87/93/94, backend
97/95/95/97) are met. Weakest spot: `App.svelte` (89 % statements, 80 % branches).

## Bundle (`npm run build`, frontend)

| File | Size | gzip |
|---|---|---|
| `index-*.js` (app + Leaflet) | 232.0 kB | 73.5 kB |
| `index-*.css` | 37.1 kB | 11.0 kB |
| `workbox-window` | 5.7 kB | 2.2 kB |
| `sw.js` | 94.3 kB | 24.8 kB |

- **A single JavaScript chunk**: Leaflet ships in the main bundle although the map is below the
  fold.
- Service worker precache: 14 entries, 336 KiB.
- City photos (`public/villes`): 3.0 MB across 12 files of 160–305 kB; `saguenay-*` is still
  JPEG, the others WebP.

## Lighthouse (mobile profile, 3 runs on the local build)

| | Run 1 | Run 2 | Run 3 |
|---|---|---|---|
| Performance | 64 | 89 | 67 |
| Accessibility | 100 | 100 | 100 |
| Best practices | 96 | 96 | 96 |
| SEO | 100 | 100 | 100 |
| FCP | 1.52 s | 1.39 s | 1.37 s |
| LCP | 3.69 s | 3.69 s | 3.68 s |
| TBT | 194 ms | 82 ms | 81 ms |
| CLS | 0.60 | 0 | 0.60 |
| Transferred | 392 kB | 392 kB | 392 kB |
| Requests | 55 | 55 | 55 |

## Findings

1. **LCP ≈ 3.7 s: it is the hero photo** (`montreal-jour.webp`, 294 kB), heavier than all the
   compressed JavaScript. First lever: size, dimensions and loading priority.
2. **Unstable CLS (0 or 0.60)**: the shift comes from `#section-reglages`, pushed down when
   content (forecasts, map) arrives after a shorter loading state. It explains the score gap
   between runs. Reserving height for the dynamic sections would remove it.
3. **About half of the JavaScript is unused at load** (36 of 73 kB gzip), consistent with
   Leaflet and the radar code being bundled upfront.
4. Accessibility 100 and SEO 100: nothing to fix there for now.
5. The only "best practices" warning (console errors) comes from tiles being unreachable in the
   measurement environment; recheck on the deployed site.

## Reproduce

```bash
cd frontend && npm ci && npm run build && npx vite preview --port 4173
# Mocked API on port 3005 (`vite preview` proxies /api to it), then:
npx lighthouse http://127.0.0.1:4173/ --preset=perf --form-factor=mobile
```
