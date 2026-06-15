export interface Ville {
  id: string;
  nom: string;
  latitude: number;
  longitude: number;
  timezone: string;
}

export const CITIES: Record<string, Ville> = {
  montreal: {
    id: 'montreal',
    nom: 'Montréal',
    latitude: 45.5019,
    longitude: -73.5674,
    timezone: 'America/Toronto',
  },
  quebec: {
    id: 'quebec',
    nom: 'Québec',
    latitude: 46.8131,
    longitude: -71.2075,
    timezone: 'America/Toronto',
  },
};
