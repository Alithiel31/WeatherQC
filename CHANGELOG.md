# CHANGELOG

## [Non publié]
### Security
- CI/CD Android : `build-twa.yml` n'est plus déclenché que depuis `main` — le keystore
  de production n'est plus déchiffré sur une branche de travail quelconque
- CI/CD Android : `deploy-twa.yml` ne récupère plus que les artefacts construits sur
  `main`, et son déclenchement manuel est restreint à `main`
- Actions tierces manipulant les secrets épinglées par SHA (`setup-android`,
  `action-download-artifact`, `upload-google-play`)
- Bloc `permissions` minimal et groupe de concurrence sur tous les workflows
- Keystore supprimé du workspace en fin de job de build

### Changed
- Les tests d'intégration n'appellent plus Open-Meteo ni Zippopotam : ils s'appuient sur
  les fixtures de `backend/tests/fixtures/` — une panne d'API externe ne casse plus la CI
- `tests/setup.ts` fait échouer tout appel réseau non mocké et isole le cache entre tests

### Added
- `npm run test:contract` + workflow nocturne `contract.yml` — vérifient le contrat réel
  des APIs externes hors du chemin critique des PR
- Couverture d'intégration : mise en cache, erreur 502 en amont, RTA inexistant

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