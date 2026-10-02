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
    /** Direction d'où vient le vent, en degrés (0 = nord). */
    directionVent: number | null;
    /** Rafales à 10 m, en km/h. */
    rafales: number | null;
    /** Indice UV de l'heure courante — lu dans la série horaire. */
    uv: number | null;
  };
  // `null` là où Open-Meteo n'a pas de valeur — au-delà de la portée d'un modèle,
  // typiquement pour les probabilités de précipitation les plus lointaines.
  horaire: {
    heure: string;
    temperature: number | null;
    code: number | null;
    precipitation: number | null;
    /** Rafales à 10 m, en km/h — utilisées par le détecteur d'alertes météo. */
    rafales: number | null;
    ressenti: number | null;
    humidite: number | null;
    vent: number | null;
    directionVent: number | null;
    /**
     * Quantité de précipitation en mm. À ne pas confondre avec `precipitation`,
     * qui est une **probabilité** en % : le renommer aurait cassé les réponses
     * déjà en cache dans les service workers.
     */
    precipitationMm: number | null;
    uv: number | null;
  }[];
  quotidien: {
    date: string;
    code: number | null;
    max: number | null;
    min: number | null;
    precipitation: number | null;
    lever: string;
    coucher: string;
    uvMax: number | null;
    /** Cumul de la journée en mm (voir `horaire[].precipitationMm`). */
    precipitationMm: number | null;
    ventMax: number | null;
    rafalesMax: number | null;
  }[];
}

/** Valeur d'une série facultative : `null` si la série ou la case est absente. */
function valeur(serie: (number | null)[] | undefined, index: number): number | null {
  return serie?.[index] ?? null;
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
      'wind_direction_10m',
      'wind_gusts_10m',
    ].join(','),
    hourly: [
      'temperature_2m',
      'weather_code',
      'precipitation_probability',
      'wind_gusts_10m',
      'apparent_temperature',
      'relative_humidity_2m',
      'wind_speed_10m',
      'wind_direction_10m',
      'precipitation',
      'uv_index',
    ].join(','),
    daily: [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'sunrise',
      'sunset',
      'uv_index_max',
      'precipitation_sum',
      'wind_speed_10m_max',
      'wind_gusts_10m_max',
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
      `Réponse Open-Meteo inexploitable : ${analyse.error.issues
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
      directionVent: raw.current.wind_direction_10m ?? null,
      rafales: raw.current.wind_gusts_10m ?? null,
      uv: valeur(raw.hourly.uv_index, start),
    },
    horaire: raw.hourly.time.slice(start, start + 48).map((t, i) => ({
      heure: t,
      temperature: raw.hourly.temperature_2m[start + i],
      code: raw.hourly.weather_code[start + i],
      precipitation: raw.hourly.precipitation_probability[start + i],
      rafales: raw.hourly.wind_gusts_10m[start + i],
      ressenti: valeur(raw.hourly.apparent_temperature, start + i),
      humidite: valeur(raw.hourly.relative_humidity_2m, start + i),
      vent: valeur(raw.hourly.wind_speed_10m, start + i),
      directionVent: valeur(raw.hourly.wind_direction_10m, start + i),
      precipitationMm: valeur(raw.hourly.precipitation, start + i),
      uv: valeur(raw.hourly.uv_index, start + i),
    })),
    quotidien: raw.daily.time.map((t, i) => ({
      date: t,
      code: raw.daily.weather_code[i],
      max: raw.daily.temperature_2m_max[i],
      min: raw.daily.temperature_2m_min[i],
      precipitation: raw.daily.precipitation_probability_max[i],
      lever: raw.daily.sunrise[i],
      coucher: raw.daily.sunset[i],
      uvMax: valeur(raw.daily.uv_index_max, i),
      precipitationMm: valeur(raw.daily.precipitation_sum, i),
      ventMax: valeur(raw.daily.wind_speed_10m_max, i),
      rafalesMax: valeur(raw.daily.wind_gusts_10m_max, i),
    })),
  };
}
