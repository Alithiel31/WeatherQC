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
 * Chemin attendu : `/villes/<id>-jour.webp` ou `/villes/<id>-nuit.webp`.
 *
 * Chemin public (pas un import de module) : un fichier absent répond 404 au
 * lieu de faire échouer le build tant que les photos ne sont pas livrées —
 * `ConditionsActuelles` retombe alors sur le dégradé via son `onerror`.
 */
export function photoVille(villeId: string | null, nuit: boolean): string | null {
  if (!villeId || !VILLES_AVEC_PHOTO.has(villeId)) return null;
  return `/villes/${villeId}-${nuit ? 'nuit' : 'jour'}.webp`;
}
