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
  gatineau: {
    id: 'gatineau',
    nom: 'Gatineau',
    latitude: 45.4765,
    longitude: -75.7013,
    timezone: 'America/Toronto',
  },
  sherbrooke: {
    id: 'sherbrooke',
    nom: 'Sherbrooke',
    latitude: 45.4042,
    longitude: -71.8929,
    timezone: 'America/Toronto',
  },
  'trois-rivieres': {
    id: 'trois-rivieres',
    nom: 'Trois-Rivières',
    latitude: 46.3432,
    longitude: -72.5432,
    timezone: 'America/Toronto',
  },
  saguenay: {
    id: 'saguenay',
    nom: 'Saguenay',
    latitude: 48.428,
    longitude: -71.0685,
    timezone: 'America/Toronto',
  },
};
