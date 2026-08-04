import { lireTexte, lireJSON, ecrire, ecrireJSON, supprimer } from './stockage.ts';
import type { LieuCP } from './types.ts';

const VILLE_DEFAUT = 'montreal';

/**
 * Un `lieuCP` relu du stockage n'est pas digne de confiance.
 *
 * `lireJSON` garantit du JSON *analysable*, pas du JSON *conforme* : une valeur
 * valide mais étrangère (`{"a":1}`) passait et partait chez le backend en
 * `lat=undefined&lon=undefined` — 400 côté serveur, « undefined (undefined) »
 * à l'écran.
 */
function estLieuValide(valeur: unknown): valeur is LieuCP {
  if (!valeur || typeof valeur !== 'object') return false;
  const lieu = valeur as Record<string, unknown>;
  return (
    typeof lieu.rta === 'string' &&
    typeof lieu.nom === 'string' &&
    typeof lieu.province === 'string' &&
    Number.isFinite(lieu.latitude) &&
    Number.isFinite(lieu.longitude)
  );
}

/**
 * Préférences de l'utilisateur, mémorisées entre les sessions.
 *
 * Regroupées ici pour qu'`App.svelte` n'ait plus à connaître ni les clés de
 * stockage ni le moment où il faut écrire : chaque mutation persiste elle-même.
 */
export function creerPreferences() {
  let codePostal = $state(lireTexte('codePostal'));

  const lieuBrut = lireJSON<unknown>('lieuCP', null);
  const lieuCharge = estLieuValide(lieuBrut) ? lieuBrut : null;
  // Une clé illisible ou d'une autre forme ne le redeviendra pas : la retirer
  // évite de repayer la validation à chaque démarrage.
  if (lieuBrut !== null && lieuCharge === null) supprimer('lieuCP');
  let lieuCP = $state<LieuCP | null>(lieuCharge);

  // Invariant : `selection === 'cp'` n'a de sens qu'avec un lieu chargé. Les
  // deux clés étaient lues indépendamment, si bien qu'un `lieuCP` corrompu
  // laissait `selection` à `'cp'` — l'application démarrait sur
  // `previsionsVille('cp')`, donc un 404, et l'onglet correspondant n'était
  // même pas rendu. Aucun moyen d'en sortir sans vider le stockage à la main.
  const selectionBrute = lireTexte('selection', VILLE_DEFAUT);
  // `lieuCharge` plutôt que `lieuCP` : lire l'état réactif ici ne capturerait que
  // sa valeur initiale, ce que Svelte signale à juste titre.
  const selectionCoherente =
    selectionBrute === 'cp' && lieuCharge === null ? VILLE_DEFAUT : selectionBrute;
  if (selectionCoherente !== selectionBrute) ecrire('selection', selectionCoherente);
  let selection = $state(selectionCoherente);

  return {
    get selection() {
      return selection;
    },
    get codePostal() {
      return codePostal;
    },
    set codePostal(valeur: string) {
      // Non persisté à la frappe : seule une recherche aboutie le mémorise.
      codePostal = valeur;
    },
    get lieuCP() {
      return lieuCP;
    },

    choisirVille(id: string) {
      selection = id;
      ecrire('selection', id);
    },

    /** Bascule sur un lieu géocodé et retient la saisie qui l'a produit. */
    retenirLieu(lieu: LieuCP, saisie: string) {
      lieuCP = lieu;
      codePostal = saisie;
      selection = 'cp';
      ecrire('selection', 'cp');
      ecrire('codePostal', saisie);
      ecrireJSON('lieuCP', lieu);
    },
  };
}

export type Preferences = ReturnType<typeof creerPreferences>;
