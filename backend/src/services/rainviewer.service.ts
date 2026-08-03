import { BadGatewayError } from '../lib/errors.js';
import { fetchAvecTimeout } from '../lib/http.js';
import { indexRainViewerSchema } from '../schemas/rainviewer.schema.js';

const URL_INDEX = 'https://api.rainviewer.com/public/weather-maps.json';

/** Hôte des tuiles quand l'index n'en déclare pas. */
export const HOTE_TUILES_DEFAUT = 'https://tilecache.rainviewer.com';

/**
 * Nombre d'images conservées par couche.
 *
 * RainViewer renvoie un historique plus long que ce que l'animation exploite ;
 * couper ici évite de faire transiter des images que personne n'affichera.
 */
const IMAGES_SATELLITE = 10;
const IMAGES_RADAR = 12;

export interface ImageRainViewer {
  time: number;
  path: string;
}

export interface FramesRainViewer {
  hote: string;
  satellite: ImageRainViewer[];
  radar: ImageRainViewer[];
}

/**
 * Index des images satellite et radar.
 *
 * Seul l'index passe par ici : les tuiles restent servies en direct par
 * `tilecache.rainviewer.com`. Les faire transiter par un Raspberry Pi derrière
 * un tunnel Cloudflare coûterait bien plus cher que le problème résolu.
 */
export async function fetchFrames(): Promise<FramesRainViewer> {
  const res = await fetchAvecTimeout(URL_INDEX, { service: 'RainViewer' });
  if (!res.ok) throw new BadGatewayError(`RainViewer a répondu ${res.status}`);

  const analyse = indexRainViewerSchema.safeParse(await res.json());
  if (!analyse.success) {
    // Dérive de contrat : panne amont (502), pas erreur interne (500).
    throw new BadGatewayError(
      `Réponse RainViewer inexploitable : ${analyse.error.issues
        .map((e) => e.path.join('.'))
        .join(', ')}`
    );
  }
  const raw = analyse.data;

  return {
    hote: raw.host || HOTE_TUILES_DEFAUT,
    satellite: (raw.satellite?.infrared ?? []).slice(-IMAGES_SATELLITE),
    // Le passé et le nowcast forment une seule animation continue.
    radar: [...(raw.radar?.past ?? []), ...(raw.radar?.nowcast ?? [])].slice(-IMAGES_RADAR),
  };
}
