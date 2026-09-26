# Photos des villes retenues

Emplacement lu par `frontend/src/lib/villesPhotos.ts`. Tant qu'un fichier
manque ici, `ConditionsActuelles.svelte` retombe silencieusement sur le
dégradé atmosphérique existant (404 → `onerror` → pas d'image affichée) —
aucun redéploiement de code n'est nécessaire pour faire apparaître une photo,
il suffit de déposer le fichier au bon nom.

## Fichiers attendus

Un fichier `jour` et un fichier `nuit` par ville, même identifiant que
`backend/src/data/cities.ts` :

- `montreal-jour.jpg` / `montreal-nuit.jpg`
- `quebec-jour.jpg` / `quebec-nuit.jpg`
- `gatineau-jour.jpg` / `gatineau-nuit.jpg`
- `sherbrooke-jour.jpg` / `sherbrooke-nuit.jpg`
- `trois-rivieres-jour.jpg` / `trois-rivieres-nuit.jpg`
- `saguenay-jour.jpg` / `saguenay-nuit.jpg`

## Format

- Paysage 16:9, sujet plutôt centré-droit, tiers gauche plus calme (ciel/eau
  uniforme) — c'est la zone où le texte est superposé.
- ~1600 px de large minimum.
- `.jpg`, poids optimisé pour une PWA (viser < 200 Ko par fichier).
