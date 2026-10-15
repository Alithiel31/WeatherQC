// Fichier généré par `npm run types:front` (backend/scripts/generer-types-front.ts)
// depuis backend/src/schemas/openapi-reponses.ts — ne pas modifier à la main.

export type Ville = {
  id: string;
  nom: string;
  latitude: number;
  longitude: number;
};

export type ReponseMeteo = {
  ville: {
    id: string;
    nom: string;
    latitude: number;
    longitude: number;
  };
  misAJour: string;
  actuel: {
    temperature: number;
    ressenti: number;
    humidite: number;
    vent: number;
    code: number;
    jour: boolean;
    /** Degrés d'où vient le vent (0 = nord) */
    directionVent?: number | null;
    /** km/h */
    rafales?: number | null;
    /** Indice UV de l'heure courante */
    uv?: number | null;
  };
  horaire: {
    heure: string;
    temperature: number | null;
    code: number | null;
    /** Probabilité de précipitation, en % */
    precipitation: number | null;
    /** km/h */
    rafales?: number | null;
    ressenti?: number | null;
    /** % */
    humidite?: number | null;
    /** km/h */
    vent?: number | null;
    /** Degrés (0 = nord) */
    directionVent?: number | null;
    /** Quantité de précipitation, en mm */
    precipitationMm?: number | null;
    uv?: number | null;
    /** Neige en cm d'épaisseur — déjà comptée, en équivalent eau, dans precipitationMm */
    neigeCm?: number | null;
  }[];
  quotidien: {
    date: string;
    code: number | null;
    max: number | null;
    min: number | null;
    /** Probabilité maximale de précipitation, en % */
    precipitation: number | null;
    lever: string;
    coucher: string;
    uvMax?: number | null;
    /** Cumul de la journée, en mm */
    precipitationMm?: number | null;
    /** km/h */
    ventMax?: number | null;
    /** km/h */
    rafalesMax?: number | null;
    /** Cumul de neige de la journée, en cm */
    neigeCm?: number | null;
  }[];
  alertes: {
    type: 'precipitation' | 'chute-temperature' | 'vent' | 'verglas' | 'orage';
    importante: boolean;
    titre: string;
    corps: string;
  }[];
  depuisCache: boolean;
  obsolete?: boolean;
};

export type LieuGeocode = {
  rta: string;
  nom: string;
  province: string;
  latitude: number;
  longitude: number;
};

export type FramesRainViewer = {
  hote: string;
  satellite: {
    path: string;
    time: number;
  }[];
  radar: {
    path: string;
    time: number;
  }[];
  depuisCache: boolean;
  obsolete?: boolean;
};

export type Sante = {
  statut: 'ok';
  versionNode: string;
  demarreDepuisS: number;
  memoireMo: number;
  cache: {
    entrees: number;
    enVol: number;
    hits: number;
    misses: number;
    obsoletes: number;
    mutualises: number;
    tauxHit: number | null;
  };
  amonts: Record<
    string,
    {
      etat: 'ferme' | 'ouvert' | 'demi-ouvert';
      echecsConsecutifs: number;
    }
  >;
};

export type Erreur = {
  status: number;
  error: string;
  details?: {
    chemin: string;
    message: string;
  }[];
  /** Pile d’appel — hors production uniquement */
  stack?: string;
};

export type ClePublique = {
  clePublique: string;
};

export type AbonnementConfirme = {
  statut: 'abonne';
};
