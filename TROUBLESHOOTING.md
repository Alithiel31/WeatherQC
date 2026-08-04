# Dépannage

🇬🇧 [English version](./TROUBLESHOOTING.en.md)

Ce document rassemble les cas déjà rencontrés sur ce projet, avec la démarche de diagnostic — pas seulement la correction finale. Avant d'ouvrir une issue, vérifier si le symptôme correspond à l'un de ceux-ci.

---

## 1. Les en-têtes de sécurité disparaissent sur une route précise (`assetlinks.json`)

### Symptôme

La CSP et les autres en-têtes de durcissement sont bien présents sur la page principale, mais absents sur `/.well-known/assetlinks.json` — ce qui fait échouer la vérification Digital Asset Links d'Android, donc la vérification d'URL du TWA.

### Cause

En nginx, `add_header` ne **fusionne pas** avec ce qui est hérité : un bloc `location` qui déclare ne serait-ce qu'un seul `add_header` perd **tous** ceux définis dans le `server` parent. `assetlinks.json` et la politique de confidentialité ont un `location` dédié pour leur `Content-Type` ; en y ajoutant un `add_header`, les en-têtes de sécurité du `server` disparaissaient de cette seule route.

### Correction

Poser les en-têtes de sécurité une seule fois, au niveau `server`, et ne jamais utiliser `add_header` dans un `location` qui doit en hériter. Pour la politique de cache, s'appuyer sur `expires`, qui n'a pas cet effet d'écrasement.

Avant d'éditer `frontend/nginx.conf`, vérifier l'effet réel avec :

```bash
curl -fsSI https://qcweather.alithiel31.dev/.well-known/assetlinks.json | grep -i content-security-policy
```

Le job `docker` de la CI (`.github/workflows/ci.yml`) fait cette vérification à chaque run, y compris le doublon de `Content-Type` qui avait le même effet — la régression ne peut plus atteindre `main` silencieusement.

---

## 2. Tous les visiteurs partagent le même quota de requêtes

### Symptôme

La limitation de débit (`RATE_LIMIT_MAX`) semble déclenchée bien avant le seuil attendu, ou au contraire jamais — comme si toutes les requêtes provenaient d'une seule IP.

### Cause

La limitation de débit s'applique par IP cliente, retrouvée via `X-Forwarded-For`. Derrière **cloudflared puis nginx**, il faut remonter exactement 2 sauts (`TRUST_PROXY_HOPS=2`) pour obtenir la vraie IP du client. Un nombre trop bas retombe sur l'IP d'un proxy intermédiaire ; trop haut, sur une IP arbitraire de l'en-tête — dans les deux cas, tous les visiteurs finissent par partager le même compteur.

### Diagnostic

Après tout changement d'infrastructure (ajout d'un proxy, changement de tunnel), vérifier depuis **deux réseaux différents** que les compteurs sont bien indépendants :

```bash
curl -s https://qcweather.alithiel31.dev/api/villes -D - | grep -i ratelimit
```

### Correction

Ajuster `TRUST_PROXY_HOPS` au nombre réel de proxies devant l'API. La valeur par défaut (`2`) correspond à la topologie actuelle : cloudflared + nginx.

---

## 3. Playwright télécharge un second Chromium à chaque run

### Symptôme

`npm run test:e2e` télécharge un Chromium alors que l'environnement en fournit déjà un — plus lent, et parfois d'une version incompatible avec celle attendue par Playwright.

### Cause

Playwright installe sa propre version pilotée de Chromium par défaut, sans se soucier de celle déjà présente sur la machine ou dans l'image CI.

### Correction

Désigner le binaire existant via la variable d'environnement `PLAYWRIGHT_CHROMIUM_PATH` plutôt que de laisser Playwright en télécharger un second.

---

## 4. Une variable d'environnement ajoutée au schéma manque dans `.env.example`

### Symptôme

Une variable existe dans `backend/src/config.ts` (donc dans le README) mais un déploiement construit à partir de `backend/.env.example` tourne avec sa valeur par défaut sans que personne ne s'en aperçoive. C'est arrivé concrètement avec `CACHE_TTL_RAINVIEWER`.

### Cause

`.env.example` est le seul fichier qu'un exploitant copie avant de déployer — ce n'est pas le README. Rien ne garantissait que toute variable ajoutée au schéma Zod y soit reportée.

### Correction

Un test dédié (`backend/tests/unit/config.test.ts`, bloc `.env.example couvre le schéma`) compare les clés de `environnementSchema` à celles présentes dans `.env.example`, dans les deux sens : une variable oubliée dans le fichier, ou une variable orpheline qui n'existe plus dans le schéma, fait échouer la CI plutôt que de se découvrir en production.

En ajoutant une variable d'environnement, la reporter systématiquement dans `backend/.env.example` **et** dans la table du README — le test attrape le premier oubli, pas le second.

---

## 5. `contract.yml` ouvre une issue `derive-contrat`

### Symptôme

Une issue étiquetée `derive-contrat` apparaît automatiquement, ou un endpoint renvoie un **502** en production en nommant un champ précis (ex. `hourly.temperature_2m`).

### Cause

Les tests d'intégration tournent sur des fixtures figées et ne peuvent pas détecter un changement de schéma chez Open-Meteo, Zippopotam ou RainViewer. Le workflow `contract.yml` interroge les vraies APIs chaque nuit ; en cas d'échec, il ouvre une issue (ou commente celle déjà ouverte) plutôt que de se limiter à une coche rouge dans un onglet Actions que personne ne consulte.

### Correction

1. Ouvrir l'exécution liée depuis l'issue pour voir quel champ a changé de forme.
2. Aligner le schéma correspondant dans `backend/src/schemas/` (`openmeteo.schema.ts`, `zippopotam.schema.ts` ou `rainviewer.schema.ts`).
3. Relancer localement : `cd backend && npm run test:contract` (appels réseau réels).
4. Une fois le schéma réaligné et le workflow repassé au vert, refermer l'issue manuellement — elle sera réutilisée tant qu'elle reste ouverte, pour éviter d'en empiler une par nuit.
