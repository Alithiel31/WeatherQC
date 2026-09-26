import { BadGatewayError, NotFoundError } from '../lib/errors.js';
import { fetchAvecTimeout } from '../lib/http.js';
import { reponseZippopotamSchema } from '../schemas/zippopotam.schema.js';
import {
  reponseGeocodageSchema,
  type ReponseGeocodage,
} from '../schemas/openmeteo-geocoding.schema.js';

/**
 * `rta` reste vide pour un lieu trouvé par nom de ville : Open-Meteo ne
 * renvoie pas de code postal, seulement des coordonnées. Les deux façons de
 * géocoder produisent la même forme pour que le reste de l'app (cache des
 * favoris, affichage) n'ait qu'un seul type de lieu géocodé à connaître.
 */
export interface LieuGeocode {
  rta: string;
  nom: string;
  province: string;
  latitude: number;
  longitude: number;
}

export async function geocodeRTA(rta: string): Promise<LieuGeocode> {
  const res = await fetchAvecTimeout(`https://api.zippopotam.us/ca/${rta}`, {
    service: 'Zippopotam',
  });

  if (res.status === 404) {
    throw new NotFoundError(`Code postal introuvable : ${rta}.`);
  }
  if (!res.ok) {
    throw new BadGatewayError(`Zippopotam a répondu ${res.status}`);
  }

  const analyse = reponseZippopotamSchema.safeParse(await res.json());
  if (!analyse.success) {
    // Contrat rompu chez Zippopotam : panne amont (502), pas erreur interne (500).
    throw new BadGatewayError(
      `Réponse Zippopotam inexploitable : ${analyse.error.issues
        .map((e) => e.path.join('.'))
        .join(', ')}`
    );
  }

  const place = analyse.data.places[0];

  if (!place) {
    throw new NotFoundError(`Aucun lieu trouvé pour ${rta}.`);
  }

  return {
    rta,
    nom: place['place name'],
    province: place.state,
    latitude: parseFloat(place.latitude),
    longitude: parseFloat(place.longitude),
  };
}

// Open-Meteo traduit `admin1` selon `language` — les deux graphies possibles
// pour le Québec cohabitent plutôt que de dépendre d'un seul accent.
const ADMIN1_QUEBEC = new Set(['Québec', 'Quebec']);

type ResultatGeocodage = NonNullable<ReponseGeocodage['results']>[number];

/**
 * Garde de type plutôt qu'un simple booléen : elle assure au compilateur que
 * `admin1` est défini pour tout résultat qui la passe, sans repli `?? …`
 * après coup — un repli aurait été du code mort, un résultat non québécois
 * étant déjà écarté ici.
 */
function estQuebecois(r: ResultatGeocodage): r is ResultatGeocodage & { admin1: string } {
  return r.country_code === 'CA' && r.admin1 !== undefined && ADMIN1_QUEBEC.has(r.admin1);
}

/**
 * Géocode un nom de ville via Open-Meteo, restreint au Québec — même
 * positionnement que `geocodeRTA` pour les codes postaux.
 *
 * Plusieurs villes québécoises peuvent partager un nom (ex. Saint-Jean) :
 * plutôt qu'un écran de désambiguïsation, on retient la plus peuplée, comme
 * le ferait quiconque tape ce nom sans plus de précision.
 */
export async function geocodeNomVille(nom: string): Promise<LieuGeocode> {
  const params = new URLSearchParams({
    name: nom,
    count: '20',
    language: 'fr',
    format: 'json',
  });

  const res = await fetchAvecTimeout(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    service: 'Open-Meteo Geocoding',
  });

  if (!res.ok) {
    throw new BadGatewayError(`Open-Meteo Geocoding a répondu ${res.status}`);
  }

  const analyse = reponseGeocodageSchema.safeParse(await res.json());
  if (!analyse.success) {
    throw new BadGatewayError(
      `Réponse Open-Meteo Geocoding inexploitable : ${analyse.error.issues
        .map((e) => e.path.join('.'))
        .join(', ')}`
    );
  }

  const meilleur = (analyse.data.results ?? [])
    .filter(estQuebecois)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];

  if (!meilleur) {
    throw new NotFoundError(`Aucune ville québécoise trouvée pour « ${nom} ».`);
  }

  return {
    rta: '',
    nom: meilleur.name,
    province: meilleur.admin1,
    latitude: meilleur.latitude,
    longitude: meilleur.longitude,
  };
}
