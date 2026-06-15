import { BadGatewayError, NotFoundError } from '../lib/errors.js';

export interface LieuGeocode {
  rta: string;
  nom: string;
  province: string;
  latitude: number;
  longitude: number;
}

export async function geocodeRTA(rta: string): Promise<LieuGeocode> {
  const res = await fetch(`https://api.zippopotam.us/ca/${rta}`);

  if (res.status === 404) {
    throw new NotFoundError(`Code postal introuvable : ${rta}.`);
  }
  if (!res.ok) {
    throw new BadGatewayError(`Zippopotam a répondu ${res.status}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = await res.json();
  const place = data.places?.[0];

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
