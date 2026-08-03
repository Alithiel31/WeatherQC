import type { ReponseMeteo, LieuCP, FramesRainViewer } from './types.ts';

export const HOTE_TUILES_DEFAUT = 'https://tilecache.rainviewer.com';

const URL_RAINVIEWER = 'https://api.rainviewer.com/public/weather-maps.json';

/**
 * Erreur portant un message destiné à l'utilisateur, fourni par le backend.
 * Se distingue d'une panne réseau, où l'on ne peut afficher qu'un message générique.
 */
export class ErreurApi extends Error {}

export async function previsionsVille(ville: string): Promise<ReponseMeteo> {
  return recupererPrevisions(`/api/previsions/${ville}`);
}

export async function previsionsCoordonnees(lieu: LieuCP): Promise<ReponseMeteo> {
  const q = new URLSearchParams({
    lat: String(lieu.latitude),
    lon: String(lieu.longitude),
    nom: lieu.nom,
  });
  return recupererPrevisions(`/api/previsions-coordonnees?${q}`);
}

async function recupererPrevisions(url: string): Promise<ReponseMeteo> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Réponse invalide du serveur');
  return (await res.json()) as ReponseMeteo;
}

export async function geocoder(codePostal: string): Promise<LieuCP> {
  const res = await fetch(`/api/geocode/${encodeURIComponent(codePostal)}`);
  const data = (await res.json()) as LieuCP & { erreur?: string };
  if (!res.ok) throw new ErreurApi(data.erreur ?? 'Code postal introuvable.');
  return data;
}

/**
 * `hoteActuel` sert de repli : RainViewer renvoie parfois un index sans champ
 * `host`, auquel cas on conserve l'hôte déjà utilisé pour les tuiles.
 */
export async function framesRainViewer(hoteActuel = HOTE_TUILES_DEFAUT): Promise<FramesRainViewer> {
  const res = await fetch(URL_RAINVIEWER);
  if (!res.ok) throw new Error('RainViewer indisponible');
  const data = await res.json();
  return {
    hote: data.host || hoteActuel,
    satellite: (data.satellite?.infrared ?? []).slice(-10),
    radar: [...(data.radar?.past ?? []), ...(data.radar?.nowcast ?? [])].slice(-12),
  };
}
