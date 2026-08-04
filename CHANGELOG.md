# CHANGELOG

## [Non publié]
### Added
- Tests de bout en bout Playwright (`frontend/e2e/`) : l'application construite est ouverte dans
  Chromium et parcourue pour de vrai. Deux chemins n'étaient couverts nulle part — le bouton
  « Réessayer », qu'aucun test ne cliquait, et le bandeau hors ligne, qu'aucun test ne faisait
  apparaître faute d'émettre `online`/`offline`. L'API y est doublée par Playwright : une suite
  de bout en bout qui dépend d'Open-Meteo redevient ce que `tests/setup.ts` interdit partout
  ailleurs

### Fixed
- `CACHE_TTL_RAINVIEWER` manquait dans `backend/.env.example` : la variable existait dans le
  schéma et dans le README, mais pas dans le seul fichier qu'un exploitant copie avant de
  déployer. Un test de parité entre le schéma et `.env.example` empêche désormais l'oubli de
  se reproduire
- Une échéance sans donnée ne s'affiche plus « 0° » : le frontend déclarait non-nullables des
  champs qu'Open-Meteo laisse à `null` au-delà de la portée du modèle, et `Math.round(null)`
  vaut `0` — une température plausible en hiver, indiscernable d'une vraie mesure. Pire, ce
  `null` comptait pour `0` dans `Math.min`, faussant l'échelle des barres min–max de **toute**
  la semaine. Les séries horaire et quotidienne portent désormais le même contrat que le
  backend, et une valeur absente se lit « — »
- Toutes les erreurs de l'API partagent l'enveloppe `{ status, error }` : le géocodage
  affichait « Code postal introuvable » sur une panne de Zippopotam (502) ou un quota
  dépassé (429), envoyant l'utilisateur corriger un code postal valide
- Une ville ne peut plus être résolue via la chaîne de prototype : `/api/previsions/constructor`
  passait la garde « ville inconnue » et partait chez Open-Meteo avec des coordonnées
  `undefined` — **502** au lieu de **404**, et un appel sortant offert à qui le demandait
- Un `lieuCP` corrompu dans `localStorage` ne blanchit plus la page : la lecture jetait
  pendant l'initialisation du composant, donc avant le premier rendu. L'application démarre
  aussi quand le navigateur refuse le stockage (Safari privé, cookies bloqués)
- Deux clics rapides entre villes ne peuvent plus afficher une ville pendant que le bouton
  actif en désigne une autre : la requête supplantée est annulée
- Les réponses d'Open-Meteo et de Zippopotam sont validées avant usage : une dérive de schéma
  donne un **502** nommant le champ fautif, au lieu d'un 500 laissant croire à un bug interne
- Une variable d'environnement invalide (`PORT=abc`, quota vide) fait échouer le démarrage en
  la nommant, au lieu de laisser tourner le serveur avec un `NaN`

### Added
- Délai maximal de 10 s sur les appels du frontend : rien ne bornait le trajet
  navigateur → nginx → backend, et une requête pendue faisait tourner le spinner sans fin
- Journalisation structurée (horodatage, niveau, contexte ; JSON en production) et en-tête
  `X-Request-Id` sur chaque réponse, repris de l'amont s'il est fourni
- `PUBLIC_ORIGINS` — le domaine public ne figurait pas dans l'allowlist CORS. L'oubli était
  invisible : nginx proxifie `/api/` en same-origin, donc aucune requête réelle ne porte
  d'en-tête `Origin`. Tout client servi depuis un autre hôte aurait été bloqué sans message
  exploitable
- `dependabot.yml` (trois manifestes npm + actions GitHub) et `npm audit` en CI sur les
  dépendances de production
- Limites mémoire et rotation des logs sur les deux conteneurs — la cible est un Raspberry Pi

### Changed
- L'index RainViewer passe par `GET /api/rainviewer` : c'était la seule dépendance tierce
  appelée en direct depuis le navigateur, sans délai maximal, sans validation de schéma et
  sans cache — chaque visiteur ouvrant la carte tapait l'API. Elle hérite du traitement des
  deux autres amonts, et le découpage des séries se fait désormais côté serveur. Seul
  l'index est proxifié : les tuiles restent chargées en direct. En contrepartie, la carte
  dépend du backend et affiche son repli quand il est injoignable
- Le sélecteur de villes est alimenté par `GET /api/villes`, jusque-là inutilisée : la liste
  était recopiée dans `App.svelte`, et ajouter une ville demandait deux éditions. La liste en
  dur subsiste comme repli hors ligne
- `App.svelte` découpé (préférences, recherche par code postal, conditions actuelles) et
  machine d'animation extraite de `CarteNuages.svelte`
- `err.issues` et `{ message }` à la place de `err.errors` et `invalid_type_error` :
  APIs supprimées en Zod 4, la montée de version n'est plus bloquée
- Zod 4 — la montée préparée plus haut est effectuée. `z.url()` remplace `z.string().url()`,
  déprécié en v4
- Node unifié sur 22 : `engines` annonçait 18, la CI tournait sur 20 et les images Docker sur
  22. Trois cibles, aucune testée ensemble — c'est celle qui tourne en production qui l'emporte
- `package.json` racine déclarait la licence ISC, `LICENSE` et le README disaient MIT
- `twa-manifest.json` annonçait `appVersionCode: 1` alors que `build.gradle` était à 3
- `README` documentait `GET /api/geocode/:rta` ; le paramètre s'appelle `:codePostal`
- L'accent manquant de « Position personnalisée », seule chaîne visible du projet à en être
  privée
- Le hook `pre-push` lance `svelte-check`, comme la CI

### Added
- Durcissement de l'API publique : en-têtes `helmet`, corps JSON plafonné à 10 ko,
  limitation de débit par IP (100 req/min sur `/api`, 20 sur `/api/geocode`)
- `TRUST_PROXY_HOPS` — retrouve l'IP réelle derrière cloudflared + nginx, sans quoi tous
  les clients partageraient le même compteur de quota
- Arrêt gracieux sur SIGTERM/SIGINT : les requêtes en vol ne sont plus coupées net
- `healthcheck` du backend dans `docker-compose.yml`, le frontend attend `service_healthy`

### Fixed
- Les appels à Open-Meteo et Zippopotam sont bornés par `FETCH_TIMEOUT_MS` (5 s par défaut) :
  une API amont lente ne laisse plus la requête Express pendue indéfiniment — dépassement
  du délai = **504**
- Une nouvelle tentative est jouée sur erreur réseau ou 5xx (GET idempotents) ; un 4xx,
  réponse légitime de l'amont, n'est jamais rejoué
- Le cache est plafonné à `CACHE_MAX_ENTRIES` (500 par défaut) avec éviction LRU : la clé des
  prévisions par coordonnées étant pilotée depuis Internet, il pouvait croître jusqu'à l'OOM
- Balayage périodique des entrées expirées — une clé jamais relue n'était purgée par rien
- Le gestionnaire d'erreurs relaie les statuts 4xx d'Express : un corps trop volumineux
  donne un **413** et un JSON malformé un **400**, au lieu d'un 500 trompeur
- `frontend/.prettierignore` — `npm run format:check` échouait sur `dist/` dès qu'un build
  local avait été fait (la CI ne le voyait pas, elle vérifie le format avant de builder)

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