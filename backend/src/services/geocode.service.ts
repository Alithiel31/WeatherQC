import { BadGatewayError, NotFoundError } from '../lib/errors.js';
import { fetchAvecTimeout } from '../lib/http.js';
import { reponseZippopotamSchema } from '../schemas/zippopotam.schema.js';

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
      `Réponse Zippopotam inexploitable : ${analyse.error.errors
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
