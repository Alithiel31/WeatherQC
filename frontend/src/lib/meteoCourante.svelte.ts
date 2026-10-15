import {
  previsionsVille,
  previsionsCoordonnees,
  geocoder,
  geocoderVille,
  villesDisponibles,
  VILLES_REPLI,
  ErreurApi,
} from './api.ts';
import type { Preferences } from './preferences.svelte.ts';
import type { ReponseMeteo, VilleDisponible, Favori } from './types.ts';

// Un code postal canadien commence toujours par lettre-chiffre-lettre (ex.
// H2X, K1A 0B1) — tout le reste part vers la recherche par nom de ville.
const FORME_CODE_POSTAL = /^[A-Za-z]\d[A-Za-z]/;

/**
 * Prévisions affichées et recherche de lieu : l'état et les règles de
 * chargement qui vivaient dans `App.svelte`.
 *
 * Même patron que `preferences.svelte.ts` — une fabrique qui expose son état
 * `$state` par des accesseurs — pour qu'`App.svelte` ne garde que la mise en
 * page et la navigation. Le comportement est inchangé : les deux règles
 * délicates (annulation de la requête supplantée, et la requête supplantée
 * qui ne rend jamais la main) sont celles qu'`App.test.ts` vérifiait déjà.
 */
export function creerMeteoCourante(prefs: Preferences) {
  // `VILLES_REPLI` le temps que `/api/villes` réponde — et indéfiniment si le
  // backend est injoignable : le sélecteur doit exister au premier rendu.
  let villes = $state<VilleDisponible[]>(VILLES_REPLI);
  let donnees = $state<ReponseMeteo | null>(null);
  let chargement = $state(true);
  let erreur = $state<string | null>(null);
  let erreurCP = $state<string | null>(null);
  let rechercheCP = $state(false);
  // Figé au moment où les données arrivent, et non dérivé des préférences :
  // celles-ci changent dès le clic, alors que `donnees` peut rester sur la ville
  // précédente si le chargement échoue. Dérivé, le libellé annonçait alors une
  // ville dont on affichait les prévisions d'une autre.
  let nomLieu = $state('');

  let chargementEnCours: AbortController | null = null;
  let rechercheEnCours: AbortController | null = null;

  async function charger(): Promise<void> {
    // Deux clics rapides lançaient deux requêtes concurrentes : si la première
    // répondait en dernier, l'écran affichait une ville et le bouton actif en
    // désignait une autre. La requête devenue inutile est annulée pour de bon.
    chargementEnCours?.abort();
    const controleur = new AbortController();
    chargementEnCours = controleur;

    // Cible et libellé capturés avec la requête : ils ne bougeront plus, même si
    // l'utilisateur reclique pendant qu'elle est en vol.
    const lieu = prefs.selection === 'cp' && prefs.lieuCP ? prefs.lieuCP : null;
    // `rta` est vide pour un lieu trouvé par nom de ville — rien à mettre entre
    // parenthèses dans ce cas, le nom seul suffit.
    const etiquette = lieu
      ? lieu.rta
        ? `${lieu.nom} (${lieu.rta})`
        : lieu.nom
      : (villes.find((v) => v.id === prefs.selection)?.nom ?? '');

    chargement = true;
    erreur = null;
    try {
      donnees = lieu
        ? await previsionsCoordonnees(lieu, controleur.signal)
        : await previsionsVille(prefs.selection, controleur.signal);
      nomLieu = etiquette;
    } catch (e) {
      // Remplacée par une requête plus récente : ni erreur, ni fin de chargement
      // — celle qui l'a supplantée s'en charge.
      if (controleur.signal.aborted) return;

      // Le backend sait pourquoi il a échoué (ville inconnue, amont injoignable,
      // quota dépassé) ; le message générique ne sert que pour une panne réseau.
      erreur =
        e instanceof ErreurApi
          ? e.message
          : 'Les prévisions ne sont pas disponibles pour le moment. Vérifiez la connexion, puis réessayez.';
    } finally {
      // Une requête supplantée ne rend pas la main : celle qui l'a remplacée est
      // encore en vol, le spinner doit rester.
      if (chargementEnCours === controleur) chargement = false;
    }
  }

  function choisirVille(id: string): void {
    if (id === prefs.selection) return;
    // L'erreur de code postal précédente n'a plus de rapport avec ce qui est
    // affiché : la laisser à l'écran à côté d'une ville chargée est trompeur.
    erreurCP = null;
    prefs.choisirVille(id);
    charger();
  }

  async function rechercherCP(saisie: string): Promise<void> {
    // Même raisonnement que `charger()` : sans annulation, deux soumissions
    // rapides laissaient la dernière réponse gagner, et `retenirLieu` persistait
    // la saisie de la fermeture périmée — `codePostal` et `lieuCP` pouvaient
    // alors décrire deux codes différents.
    rechercheEnCours?.abort();
    const controleur = new AbortController();
    rechercheEnCours = controleur;

    erreurCP = null;
    rechercheCP = true;
    try {
      const lieu = FORME_CODE_POSTAL.test(saisie)
        ? await geocoder(saisie, controleur.signal)
        : await geocoderVille(saisie, controleur.signal);
      prefs.retenirLieu(lieu, saisie);
      charger();
    } catch (e) {
      if (controleur.signal.aborted) return;
      erreurCP =
        e instanceof ErreurApi ? e.message : 'Recherche impossible. Vérifiez la connexion.';
    } finally {
      if (rechercheEnCours === controleur) rechercheCP = false;
    }
  }

  /** Charge les prévisions d'un favori choisi dans l'écran Favoris. */
  function choisirFavori(favori: Favori): void {
    if (favori.type === 'ville') {
      choisirVille(favori.id);
    } else {
      // Déjà géocodé (c'est un favori) : inutile de regéocoder le RTA. `rta`
      // sert de saisie de repli — le code postal complet d'origine n'est pas
      // conservé dans le favori, seul le lieu géocodé l'est.
      prefs.retenirLieu(favori.lieu, favori.lieu.rta);
      charger();
    }
  }

  /** Remplace le repli par la liste du backend. Échec silencieux : `VILLES_REPLI` couvre déjà le sélecteur. */
  function chargerVilles(): void {
    villesDisponibles()
      .then((liste) => {
        if (liste.length) villes = liste;
      })
      .catch(() => {});
  }

  /** Annule les requêtes en vol — au démontage de l'application. */
  function annuler(): void {
    chargementEnCours?.abort();
    rechercheEnCours?.abort();
  }

  return {
    get villes() {
      return villes;
    },
    get donnees() {
      return donnees;
    },
    get chargement() {
      return chargement;
    },
    get erreur() {
      return erreur;
    },
    get erreurCP() {
      return erreurCP;
    },
    get rechercheCP() {
      return rechercheCP;
    },
    get nomLieu() {
      return nomLieu;
    },
    charger,
    choisirVille,
    rechercherCP,
    choisirFavori,
    chargerVilles,
    annuler,
  };
}

export type MeteoCourante = ReturnType<typeof creerMeteoCourante>;
