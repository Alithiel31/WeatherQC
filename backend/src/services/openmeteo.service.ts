import { BadGatewayError } from '../lib/errors.js';

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
  horaire: {
    heure: string;
    temperature: number;
    code: number;
    precipitation: number;
  }[];
  quotidien: {
    date: string;
    code: number;
    max: number;
    min: number;
    precipitation: number;
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
  timezone = 'America/Toronto',
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

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new BadGatewayError(`Open-Meteo a répondu ${res.status}`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = await res.json();

  const nowIndex = raw.hourly.time.findIndex(
    (t: string) => new Date(t) >= new Date(raw.current.time)
  );
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
    horaire: raw.hourly.time.slice(start, start + 48).map((t: string, i: number) => ({
      heure: t,
      temperature: raw.hourly.temperature_2m[start + i],
      code: raw.hourly.weather_code[start + i],
      precipitation: raw.hourly.precipitation_probability[start + i],
    })),
    quotidien: raw.daily.time.map((t: string, i: number) => ({
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
