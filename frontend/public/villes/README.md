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
- `quebec-jour.webp` / `quebec-nuit.webp`
- `gatineau-jour.webp` / `gatineau-nuit.webp`
- `sherbrooke-jour.webp` / `sherbrooke-nuit.webp`
- `trois-rivieres-jour.webp` / `trois-rivieres-nuit.webp`
- `saguenay-jour.webp` / `saguenay-nuit.webp`

## Format

- Paysage 16:9, sujet plutôt centré-droit, tiers gauche plus calme (ciel/eau
  uniforme) — c'est la zone où le texte est superposé.
- ~1600 px de large minimum.
- `.webp` (pas de traitement offline particulier : ces fichiers ne sont pas
  ajoutés au précache du service worker, `vite.config.js` ne liste que les
  icônes dans `includeAssets` — un lieu hors ligne retombe simplement sur le
  dégradé, comme pour la carte animée). Viser < 200 Ko par fichier ; les deux
  premières livrées (Montréal) sont à 226 Ko et 287 Ko — acceptable, pas
  urgent à retravailler.
