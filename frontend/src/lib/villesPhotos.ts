/**
 * Villes couvertes par un visuel dédié (jour + nuit), sous `public/villes/`.
 *
 * Mêmes identifiants que `backend/src/data/cities.ts` — c'est la liste qui
 * fait foi, pas `VILLES_REPLI` (repli hors-ligne du sélecteur, incomplet).
 * Un lieu hors de cette liste (recherche par code postal, ou photo pas
 * encore livrée) garde le dégradé atmosphérique existant : `photoVille`
 * rend `null` et `ConditionsActuelles` ne tente aucun chargement.
 */
const VILLES_AVEC_PHOTO = new Set([
  'montreal',
  'quebec',
  'gatineau',
  'sherbrooke',
  'trois-rivieres',
  'saguenay',
]);

/**
 * `.webp` par défaut ; exception par ville quand le fichier livré était déjà
 * dans un autre format (pas d'outil de conversion disponible au moment de
 * l'intégration) — renommer l'extension mentirait sur le type MIME servi.
 */
const EXTENSION_PAR_VILLE: Record<string, string> = {
  saguenay: 'jpg',
};

/**
 * Chemin attendu : `/villes/<id>-jour.<ext>` ou `/villes/<id>-nuit.<ext>`.
 *
 * Chemin public (pas un import de module) : un fichier absent répond 404 au
 * lieu de faire échouer le build tant que les photos ne sont pas livrées —
 * `ConditionsActuelles` retombe alors sur le dégradé via son `onerror`.
 */
export function photoVille(villeId: string | null, nuit: boolean): string | null {
  if (!villeId || !VILLES_AVEC_PHOTO.has(villeId)) return null;
  const extension = EXTENSION_PAR_VILLE[villeId] ?? 'webp';
  return `/villes/${villeId}-${nuit ? 'nuit' : 'jour'}.${extension}`;
}
