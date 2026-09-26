export interface Ville {
  id: string;
  nom: string;
  latitude: number;
  longitude: number;
}

/** Entrée du sélecteur — sous-ensemble de ce que renvoie `GET /api/villes`. */
export interface VilleDisponible {
  id: string;
  nom: string;
}

export interface ConditionsActuelles {
  temperature: number;
  ressenti: number;
  humidite: number;
  vent: number;
  code: number;
  jour: boolean;
}

/**
 * `null` là où Open-Meteo n'a pas de valeur — typiquement les probabilités de
 * précipitation les plus lointaines, au-delà de la portée du modèle.
 *
 * Ces champs étaient déclarés non-nullables alors que le backend les type
 * honnêtement (`backend/src/services/openmeteo.service.ts`, qui fait foi) :
 * TypeScript ne voyait rien et `Math.round(null)` affichait « 0° », une valeur
 * plausible en hiver. Le mensonge coûtait plus cher que la donnée manquante.
 */
export interface PrevisionsHoraires {
  heure: string;
  temperature: number | null;
  code: number | null;
  precipitation: number | null;
}

export interface PrevisionsQuotidiennes {
  date: string;
  code: number | null;
  max: number | null;
  min: number | null;
  precipitation: number | null;
  lever: string;
  coucher: string;
}

/**
 * Alerte météo réelle, déjà rédigée côté backend
 * (`detecterAlertes`/`redigerNotification`) — les mêmes fonctions pures que
 * celles qui décident d'envoyer une notification push. Le frontend n'a donc
 * pas à connaître les seuils ni les types d'alerte pour l'afficher.
 */
export interface Alerte {
  type: string;
  importante: boolean;
  titre: string;
  corps: string;
}

export interface ReponseMeteo {
  ville: Ville;
  misAJour: string;
  actuel: ConditionsActuelles;
  horaire: PrevisionsHoraires[];
  quotidien: PrevisionsQuotidiennes[];
  alertes: Alerte[];
  depuisCache: boolean;
  /**
   * Vrai quand le backend a servi une entrée périmée parce que l'amont était en
   * panne. Les prévisions restent utiles, mais elles ne sont plus à jour — et le
   * dire vaut mieux que d'afficher une heure de mise à jour trompeuse.
   */
  obsolete?: boolean;
}

export interface LieuCP {
  rta: string;
  nom: string;
  province: string;
  latitude: number;
  longitude: number;
}

/**
 * Un favori désigne soit une ville du sélecteur (par son `id`, stable), soit un
 * lieu géocodé par code postal (le `LieuCP` complet — sans ça, le retrouver
 * demanderait de regéocoder le RTA à chaque démarrage). Type discriminé plutôt
 * que deux listes séparées : un seul endroit décide de ce qu'est un favori, et
 * `Favoris.svelte` n'a qu'une seule liste à parcourir dans l'ordre d'ajout.
 */
export type Favori = { type: 'ville'; id: string; nom: string } | { type: 'cp'; lieu: LieuCP };

export interface ImageRainViewer {
  path: string;
  time: number;
}

export interface FramesRainViewer {
  hote: string;
  satellite: ImageRainViewer[];
  radar: ImageRainViewer[];
}
