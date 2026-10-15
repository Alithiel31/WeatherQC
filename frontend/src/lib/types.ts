/**
 * Types du frontend.
 *
 * Ceux qui décrivent une réponse de l'API ne sont plus écrits à la main : ils
 * viennent de `api-genere.ts`, produit depuis les schémas du backend (voir
 * `backend/scripts/generer-types-front.ts`). Un champ renommé ou retiré côté
 * backend casse donc la compilation ici, au lieu de l'affichage en production.
 *
 * Les noms historiques sont conservés pour ne rien changer aux imports. Les
 * champs ajoutés pour le tableau de bord restent optionnels et nullables, côté
 * schéma : une réponse mise en cache par le service worker avant leur
 * introduction (jusqu'à 6 h) ne les a pas, et Open-Meteo n'a pas toujours de
 * valeur — `Math.round(null)` affichait « 0° », une valeur plausible en hiver.
 */
import type * as Api from './api-genere.ts';

export type Ville = Api.Ville;
export type ReponseMeteo = Api.ReponseMeteo;
export type ConditionsActuelles = ReponseMeteo['actuel'];
export type PrevisionsHoraires = ReponseMeteo['horaire'][number];
export type PrevisionsQuotidiennes = ReponseMeteo['quotidien'][number];

/**
 * Alerte météo réelle, déjà rédigée côté backend
 * (`detecterAlertes`/`redigerNotification`) — les mêmes fonctions pures que
 * celles qui décident d'envoyer une notification push. Le frontend n'a donc
 * pas à connaître les seuils pour l'afficher.
 */
export type Alerte = ReponseMeteo['alertes'][number];

/**
 * Lieu géocodé — par code postal (`rta` porte alors le FSA, ex. « H2X ») ou par
 * nom de ville (`rta` vide : Open-Meteo ne renvoie pas de code postal).
 */
export type LieuCP = Api.LieuGeocode;

/**
 * Index RainViewer tel que l'utilise la carte. Les indicateurs de cache du
 * backend (`depuisCache`, `obsolete`) n'y servent pas : `framesRainViewer()`
 * ne les relaie pas.
 */
export type FramesRainViewer = Omit<Api.FramesRainViewer, 'depuisCache' | 'obsolete'>;
export type ImageRainViewer = FramesRainViewer['radar'][number];

/** Entrée du sélecteur — sous-ensemble de ce que renvoie `GET /api/villes`. */
export type VilleDisponible = Pick<Ville, 'id' | 'nom'>;

/**
 * Un favori désigne soit une ville du sélecteur (par son `id`, stable), soit un
 * lieu géocodé par code postal (le `LieuCP` complet — sans ça, le retrouver
 * demanderait de regéocoder le RTA à chaque démarrage). Type discriminé plutôt
 * que deux listes séparées : un seul endroit décide de ce qu'est un favori, et
 * `Favoris.svelte` n'a qu'une seule liste à parcourir dans l'ordre d'ajout.
 */
export type Favori = { type: 'ville'; id: string; nom: string } | { type: 'cp'; lieu: LieuCP };
