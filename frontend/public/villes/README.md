# Photos des villes retenues

Emplacement lu par `frontend/src/lib/villesPhotos.ts`. Tant qu'un fichier
manque ici, `ConditionsActuelles.svelte` retombe silencieusement sur le
dégradé atmosphérique existant (404 → `onerror` → pas d'image affichée) —
aucun redéploiement de code n'est nécessaire pour faire apparaître une photo,
il suffit de déposer le fichier au bon nom.

## Fichiers attendus

Un fichier `jour` et un fichier `nuit` par ville, même identifiant que
`backend/src/data/cities.ts` :

- `montreal-jour.webp` / `montreal-nuit.webp` ✅ livrées
- `quebec-jour.webp` / `quebec-nuit.webp` ✅ livrées
- `gatineau-jour.webp` / `gatineau-nuit.webp` ✅ livrées
- `sherbrooke-jour.webp` / `sherbrooke-nuit.webp` ✅ livrées
- `trois-rivieres-jour.webp` / `trois-rivieres-nuit.webp` ✅ livrées
- `saguenay-jour.webp` / `saguenay-nuit.webp` ✅ livrées

**Les six villes sont livrées.**

## Format

- Paysage 16:9, sujet plutôt centré-droit, tiers gauche plus calme (ciel/eau
  uniforme) — c'est la zone où le texte est superposé.
- ~1000 px de large (le conteneur fait 32 rem au maximum, soit 1024 px à
  densité ×2) : plus grand ne fait qu'alourdir le LCP.
- `.webp` uniquement (extension fixée dans `villesPhotos.ts`) — pas de traitement
  offline particulier : ces fichiers ne sont pas ajoutés au précache du
  service worker, `vite.config.js` ne liste que les icônes dans
  `includeAssets` — un lieu hors ligne retombe simplement sur le dégradé,
  comme pour la carte animée. Viser < 100 Ko par fichier ; les douze livrées
  vont de 24 à 67 Ko (`convert in -resize 1000x -strip -quality 72 out.webp`).
