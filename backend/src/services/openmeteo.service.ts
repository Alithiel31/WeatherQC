import { config } from '../config.js';
import { BadGatewayError } from '../lib/errors.js';
import { fetchAvecTimeout } from '../lib/http.js';
import { previsionsOpenMeteoSchema } from '../schemas/openmeteo.schema.js';

export interface Previsions {
  misAJour: string;
  actuel: {
    temperature: number;
    ressenti: number;
    humidite: number;
    vent: number;
    code: number;
    jour: boolean;
  };
  // `null` là où Open-Meteo n'a pas de valeur — au-delà de la portée d'un modèle,
  // typiquement pour les probabilités de précipitation les plus lointaines.
  horaire: {
    heure: string;
    temperature: number | null;
    code: number | null;
    precipitation: number | null;
  }[];
  quotidien: {
    date: string;
    code: number | null;
    max: number | null;
    min: number | null;
    precipitation: number | null;
    lever: string;
    coucher: string;
  }[];
}

interface FetchForecastParams {
  latitude: number;
  longitude: number;
  timezone?: string;
}

export async function fetchForecast({
  latitude,
  longitude,
  timezone = config.defaultTimezone,
}: FetchForecastParams): Promise<Previsions> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    timezone,
    current: [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'weather_code',
      'wind_speed_10m',
      'is_day',
    ].join(','),
    hourly: ['temperature_2m', 'weather_code', 'precipitation_probability'].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'sunrise',
      'sunset',
    ].join(','),
    forecast_days: '7',
  });

  const res = await fetchAvecTimeout(`https://api.open-meteo.com/v1/forecast?${params}`, {
    service: 'Open-Meteo',
  });
  if (!res.ok) throw new BadGatewayError(`Open-Meteo a répondu ${res.status}`);

  const analyse = previsionsOpenMeteoSchema.safeParse(await res.json());
  if (!analyse.success) {
    // Une dérive de contrat est une panne amont, pas un bug interne : 502, pas 500.
    throw new BadGatewayError(
      `Réponse Open-Meteo inexploitable : ${analyse.error.errors
        .map((e) => e.path.join('.'))
        .join(', ')}`
    );
  }
  const raw = analyse.data;

  const nowIndex = raw.hourly.time.findIndex((t) => new Date(t) >= new Date(raw.current.time));
  const start = Math.max(nowIndex, 0);

  return {
    misAJour: raw.current.time,
    actuel: {
      temperature: raw.current.temperature_2m,
      ressenti: raw.current.apparent_temperature,
      humidite: raw.current.relative_humidity_2m,
      vent: raw.current.wind_speed_10m,
      code: raw.current.weather_code,
      jour: raw.current.is_day === 1,
    },
    horaire: raw.hourly.time.slice(start, start + 48).map((t, i) => ({
      heure: t,
      temperature: raw.hourly.temperature_2m[start + i],
      code: raw.hourly.weather_code[start + i],
      precipitation: raw.hourly.precipitation_probability[start + i],
    })),
    quotidien: raw.daily.time.map((t, i) => ({
      date: t,
      code: raw.daily.weather_code[i],
      max: raw.daily.temperature_2m_max[i],
      min: raw.daily.temperature_2m_min[i],
      precipitation: raw.daily.precipitation_probability_max[i],
      lever: raw.daily.sunrise[i],
      coucher: raw.daily.sunset[i],
    })),
  };
}
