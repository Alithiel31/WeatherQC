import { lireTexte, lireJSON, ecrire, ecrireJSON } from './stockage.ts';
import type { LieuCP } from './types.ts';

/**
 * Préférences de l'utilisateur, mémorisées entre les sessions.
 *
 * Regroupées ici pour qu'`App.svelte` n'ait plus à connaître ni les clés de
 * stockage ni le moment où il faut écrire : chaque mutation persiste elle-même.
 */
export function creerPreferences() {
  let selection = $state(lireTexte('selection', 'montreal'));
  let codePostal = $state(lireTexte('codePostal'));
  let lieuCP = $state<LieuCP | null>(lireJSON<LieuCP | null>('lieuCP', null));

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
