export interface Ville {
  id: string;
  nom: string;
  latitude: number;
  longitude: number;
}

export interface ConditionsActuelles {
  temperature: number;
  ressenti: number;
  humidite: number;
  vent: number;
  code: number;
  jour: boolean;
}

export interface PrevisionsHoraires {
  heure: string;
  temperature: number;
  code: number;
  precipitation: number;
}

export interface PrevisionsQuotidiennes {
  date: string;
  code: number;
  max: number;
  min: number;
  precipitation: number;
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
