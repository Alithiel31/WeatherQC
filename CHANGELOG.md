# CHANGELOG

## [2.1.1] - 2026-08-02
### Changed
- TWA Android : `targetSdkVersion` 35 → 36 (Android 16) pour respecter l'exigence
  Google Play du 31 août 2026 sur le niveau d'API cible
- TWA Android : `versionCode` 2 → 3 et `versionName` "2" → "3" (obligatoire pour
  publier une nouvelle version sur la piste Internal Testing)
- TWA Android : `versionCode` désormais dérivé de `GITHUB_RUN_NUMBER` en CI —
  plus de bump manuel à chaque release
- TWA Android : dépôt `jcenter()` (arrêté depuis 2021) remplacé par `mavenCentral()`

### Removed
- `backend/dist/` retiré du suivi git — artefact de build régénéré par `tsc`
- `backend/server.js` — monolithe pré-refactorisation, remplacé par `src/`
- `frontend/src/main.js` et `frontend/src/lib/meteo.js` — doublons obsolètes
  des versions TypeScript (`main.ts`, `meteo.ts`)

## [2.1.0] - 2026-06-18
### Added
- Workflow CI/CD `build-twa.yml` — build et signature automatiques du `.aab` Android
- Workflow `deploy-twa.yml` — publication automatique sur Play Store (Internal Testing)
- Hook Husky `pre-push` — tests lancés automatiquement avant chaque push

### Fixed
- Linter et formatage Prettier corrigés sur backend et frontend

## [2.0.1] - 2026-06-15
### Added
- Validation stricte des inputs avec Zod
- Tests automatisés (unit + intégration)
- Prettier pour le formatage

### Fixed
- Gestion d'erreurs Zod dans le middleware

## [2.0.0] - 2026-06-11
### Initial Release
- API REST Express + Frontend Svelte PWA
- Cache configurable
- Prévisions météo Open-Meteo