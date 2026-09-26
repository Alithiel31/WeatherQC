# Développement local

🇬🇧 [English version](./developpement.en.md)

[Retour au README](../README.md)

## Backend (port 3005)

```bash
cd backend && npm install
npm run dev        # rechargement auto (tsx --watch)
```

Routes disponibles :

| Route | Description |
|---|---|
| `GET /api/villes` | Liste des villes disponibles |
| `GET /api/previsions/:ville` | Prévisions par ville (`montreal`, `quebec`, `gatineau`, `sherbrooke`, `trois-rivieres`, `saguenay`) |
| `GET /api/previsions-coordonnees?lat=&lon=&nom=` | Prévisions pour un point GPS |
| `GET /api/geocode/:codePostal` | Géocode une RTA québécoise (ex. `H2X`) |
| `GET /api/geocode-ville/:nom` | Géocode une ville québécoise par son nom |
| `GET /api/rainviewer` | Index des images satellite et radar pour la carte animée |
| `GET /api/sante` | Vérification de l'état du service |
| `GET /api/openapi.json` | Document OpenAPI 3.1 de l'API |
| `GET /api/notifications/cle-publique` | Clé VAPID publique, nécessaire au navigateur pour s'abonner aux alertes météo |
| `POST /api/notifications/abonnement` | Enregistre l'abonnement `PushManager` du navigateur pour une ville |
| `DELETE /api/notifications/abonnement` | Retire un abonnement (idempotent) |

`openapi.json` est généré au démarrage depuis les mêmes schémas Zod que ceux qui valident
réellement les requêtes (`backend/src/schemas/validation.ts`) — pas une spec écrite à la main
qu'on oublierait de mettre à jour. Les corps de réponse, eux, n'ont pas ce filet : le backend ne
valide pas ses propres sorties, `backend/src/schemas/openapi-reponses.ts` les décrit séparément à
la seule fin de documenter. Pour l'explorer : coller l'URL dans
[Swagger Editor](https://editor.swagger.io) ou l'importer dans Postman/Insomnia — rien n'est
servi en HTML par le backend, pour ne pas avoir à assouplir la CSP posée par nginx.

Les appels aux APIs externes sont bornés par `FETCH_TIMEOUT_MS` et rejoués une fois en cas
d'erreur réseau ou 5xx. Un amont qui ne répond pas à temps donne un **504**, un amont en
erreur un **502** — jamais une requête suspendue.

Les trois amonts passent par ce même chemin, RainViewer compris : son index transitait
autrefois directement du navigateur vers `api.rainviewer.com`, sans cache ni quota. Seul
l'**index** est proxifié — les tuiles restent chargées en direct depuis
`tilecache.rainviewer.com`, les faire transiter par le Raspberry Pi coûterait bien plus cher
que ce que le cache ferait gagner. En contrepartie, la carte dépend désormais du backend :
si celui-ci est injoignable, elle affiche son message de repli au lieu de se débrouiller
seule.

Les origines CORS autorisées sont le poste de développement, l'IP Tailscale si elle est
configurée, et celles déclarées par `PUBLIC_ORIGINS`. En production, nginx proxifie `/api/`
en same-origin : aucune requête ne porte d'en-tête `Origin`, donc un domaine public absent de
la liste ne se voit sur aucune requête réelle — jusqu'au jour où un client est servi depuis
un autre hôte.

L'API est exposée publiquement : en-têtes de durcissement (`helmet`), corps JSON plafonné à
10 ko et limitation de débit par IP cliente (**429** au-delà du quota). `/api/sante` n'est
jamais limité — le healthcheck Docker l'interroge toutes les 30 s.

Les réponses des APIs externes sont validées avant usage : une dérive de schéma chez Open-Meteo
ou Zippopotam donne un **502** nommant le champ fautif, jamais un 500. Toutes les erreurs
partagent la même enveloppe `{ status, error }`, à laquelle les erreurs de validation ajoutent
`details`.

Chaque réponse porte un en-tête `X-Request-Id` — repris de l'amont s'il est fourni — qu'on
retrouve dans les logs. Un utilisateur qui signale une panne peut citer cet identifiant :

```bash
docker compose --env-file frontend/.env logs backend | grep <identifiant>
```

Chaque requête terminée produit une ligne — méthode, chemin, statut, durée, et l'origine de la
réponse (`frais`, `obsolete`, `amont`) — et chaque appel amont la sienne, avec sa latence.
C'est ce qui permet de trancher « c'est Open-Meteo » de « c'est le Pi » sans instrumenter quoi
que ce soit. Les rejets du limiteur, qui n'atteignent jamais le gestionnaire d'erreurs,
apparaissent en `warn` avec leur 429.

`GET /api/sante` complète le tableau : version de Node, temps depuis le démarrage, mémoire
résidente, statistiques de cache (entrées, hits, misses, taux) et état des disjoncteurs amont.

Mécanismes de résilience réseau (mutualisation des requêtes, cache dégradé, disjoncteur) : voir
[Résilience des amonts](./architecture.md#résilience-des-amonts).

## Tests (backend)

| Commande | Portée | Réseau |
|---|---|---|
| `npm run test:run` | Unitaires + intégration — lancé par le hook `pre-push` | ❌ aucun appel réseau |
| `npm run test:unit` | Unitaires seuls | ❌ aucun appel réseau |
| `npm run test:coverage` | Idem + rapport de couverture — **c'est ce que lance la CI** | ❌ aucun appel réseau |
| `npm run test:contract` | Vérifie le contrat réel d'Open-Meteo, de Zippopotam et de RainViewer | ✅ appels réels |

Les tests d'intégration s'appuient sur les fixtures de `backend/tests/fixtures/` : une panne
d'API externe ne peut plus faire échouer une PR. `tests/setup.ts` fait échouer explicitement
tout appel réseau non mocké.

Les tests de contrat tournent séparément via le workflow `contract.yml` (nocturne + manuel) :
c'est lui qui détecte une dérive de schéma chez les APIs externes. En cas d'échec il **ouvre
une issue** étiquetée `derive-contrat`, et la réutilise tant qu'elle est ouverte — une
détection que personne ne lit n'est pas une détection.

Le job `docker` de la CI ne se contente plus de construire les images : il démarre la pile avec
`docker compose up --wait` — ce qui exerce le healthcheck du backend, le
`depends_on: service_healthy` du frontend et la configuration nginx dans son vrai réseau —
puis interroge `/api/sante`, `/api/villes` et la coquille applicative à travers nginx. Une
variable d'environnement invalide, un healthcheck cassé ou une config nginx fautive échouent
désormais en CI plutôt qu'au déploiement.

> `nginx -t` dans un conteneur isolé ne convient pas ici : `proxy_pass http://backend:3005`
> exige de résoudre l'hôte `backend`, qui n'existe que dans le réseau du compose. C'est le
> démarrage réel qui fait office de test.

`test:coverage` échoue sous les seuils déclarés dans `backend/vitest.config.ts`. Ils sont
calés **sous la mesure réelle**, pas sur un chiffre rond : ils bloquent une régression
franche sans casser la CI dès qu'un refactor ajoute une garde difficile à atteindre.
`app.ts` est exclu de la mesure — il ne contient que `listen()` et les gestionnaires de
signaux, dont la vérification réelle est le healthcheck Docker.

## Frontend (port 5173)

```bash
cd frontend && npm install
npm run dev
```

Ouvrir `http://localhost:5173`. Le proxy Vite redirige `/api` vers le backend.

Tous les appels réseau passent par `src/lib/api.ts` — c'est le seul endroit où `fetch`
est appelé côté frontend, ce qui permet de le stubber d'un bloc dans les tests.

## Tests (frontend)

| Commande | Portée |
|---|---|
| `npm run test` | Mode watch pendant le développement |
| `npm run test:run` | Une passe complète |
| `npm run test:coverage` | Idem + rapport de couverture |
| `npm run test:ci` | Idem + `rapport-tests.json` — **c'est ce que lance la CI** |
| `npm run test:pwa` | Uniquement les vérifications PWA (manifeste + service worker) |
| `npm run test:e2e` | Parcours de bout en bout dans Chromium (Playwright) |

La CI publie `frontend/coverage/` et `frontend/rapport-tests.json` en artefact
(`frontend-rapports`, conservé 14 jours), y compris quand le job échoue — c'est là que le
rapport est le plus utile.

Environnement `jsdom` + Testing Library. Comme côté backend, `tests/setup.ts` fait échouer
explicitement tout appel réseau non mocké : un test ne peut pas dépendre de la disponibilité
du backend ou de RainViewer.

Les seuils de couverture vivent dans `frontend/vitest.config.ts`, calés sous la mesure
réelle. `src/main.ts` en est exclu : il ne fait que monter l'app et enregistrer le service
worker.

## Parcours de bout en bout

`e2e/` ouvre l'application **construite** dans Chromium via Playwright : sélection de ville et
persistance du choix, recherche par code postal, message d'erreur du backend, bouton
« Réessayer », bascule hors ligne, démarrage avec un stockage corrompu.

L'API y est doublée par Playwright plutôt que servie par le vrai backend. Une suite de bout en
bout qui dépend d'Open-Meteo redevient exactement ce que `tests/setup.ts` interdit partout
ailleurs : un test qui échoue pour une raison étrangère au code. Le service worker est
neutralisé pour la même raison — il intercepterait les requêtes avant les doublures, et ses
garanties sont déjà vérifiées sur la sortie de build par `tests/pwa/build.test.ts`.

```bash
cd frontend && npm run test:e2e
```

> Un environnement fournissant déjà Chromium peut le désigner par
> `PLAYWRIGHT_CHROMIUM_PATH` au lieu d'en télécharger un second, souvent d'une version
> incompatible avec celle qu'attend Playwright.

## Vérifications PWA

`tests/pwa/build.test.ts` reconstruit l'app et lit la sortie de `dist/` pour vérifier les
deux promesses affichées plus haut — installabilité et fonctionnement hors ligne :

- le manifeste déclare `display: standalone`, un `start_url`, les icônes 192/512 et une
  icône `maskable`, et n'y référence que des fichiers réellement présents ;
- le service worker est généré, enregistré par le bundle, et précache la coquille ;
- les stratégies de cache attendues sont bien câblées (`NetworkFirst` sur
  `/api/previsions`, `CacheFirst` sur les tuiles de fond).

```bash
cd frontend && npm run test:pwa
```

> **Pourquoi pas Lighthouse** — depuis Lighthouse 12, la catégorie PWA et ses audits
> (`installable-manifest`, `service-worker`) ont été **supprimés** ; Lighthouse 13 ne
> connaît plus que `performance`, `accessibility`, `best-practices` et `seo`. Auditer
> l'installabilité imposerait d'épingler une version abandonnée, plus un Chrome headless
> et un serveur statique en CI. Les mêmes garanties se lisent dans la sortie de build,
> en quelques secondes et sans navigateur.
