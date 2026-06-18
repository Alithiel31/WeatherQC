# CHANGELOG

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