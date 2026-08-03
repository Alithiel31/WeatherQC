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

export interface ReponseMeteo {
  ville: Ville;
  misAJour: string;
  actuel: ConditionsActuelles;
  horaire: PrevisionsHoraires[];
  quotidien: PrevisionsQuotidiennes[];
  depuisCache: boolean;
}

export interface LieuCP {
  rta: string;
  nom: string;
  province: string;
  latitude: number;
  longitude: number;
}

export interface ImageRainViewer {
  path: string;
  time: number;
}

export interface FramesRainViewer {
  hote: string;
  satellite: ImageRainViewer[];
  radar: ImageRainViewer[];
}
