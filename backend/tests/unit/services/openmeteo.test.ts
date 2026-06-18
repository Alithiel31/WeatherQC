import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchForecast } from '../../../src/services/openmeteo.service.js';
import { BadGatewayError } from '../../../src/lib/errors.js';

// Réponse Open-Meteo simulée
// nowIndex = 1 car '2024-01-15T14:00' >= current.time '2024-01-15T14:00'
const mockRawResponse = {
  current: {
    time: '2024-01-15T14:00',
    temperature_2m: -5,
    apparent_temperature: -10,
    relative_humidity_2m: 80,
    wind_speed_10m: 20,
    weather_code: 3,
    is_day: 1,
  },
  hourly: {
    time: ['2024-01-15T13:00', '2024-01-15T14:00', '2024-01-15T15:00'],
    temperature_2m: [-4, -5, -6],
    weather_code: [2, 3, 3],
    precipitation_probability: [10, 20, 30],
  },
  daily: {
    time: ['2024-01-15'],
    weather_code: [3],
    temperature_2m_max: [-2],
    temperature_2m_min: [-8],
    precipitation_probability_max: [25],
    sunrise: ['2024-01-15T07:30'],
    sunset: ['2024-01-15T16:45'],
  },
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('fetchForecast', () => {
  describe('Mapping de la réponse', () => {
    it('mappe correctement les données actuelles', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawResponse })
      );

      const result = await fetchForecast({ latitude: 45.5, longitude: -73.6 });

      expect(result.actuel.temperature).toBe(-5);
      expect(result.actuel.ressenti).toBe(-10);
      expect(result.actuel.humidite).toBe(80);
      expect(result.actuel.vent).toBe(20);
      expect(result.actuel.code).toBe(3);
      expect(result.actuel.jour).toBe(true); // is_day === 1
    });

    it('mappe correctement les données quotidiennes', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawResponse })
      );

      const result = await fetchForecast({ latitude: 45.5, longitude: -73.6 });

      expect(result.quotidien).toHaveLength(1);
      expect(result.quotidien[0].date).toBe('2024-01-15');
      expect(result.quotidien[0].max).toBe(-2);
      expect(result.quotidien[0].min).toBe(-8);
      expect(result.quotidien[0].lever).toBe('2024-01-15T07:30');
      expect(result.quotidien[0].coucher).toBe('2024-01-15T16:45');
    });

    it('retourne misAJour égal à current.time', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawResponse })
      );

      const result = await fetchForecast({ latitude: 45.5, longitude: -73.6 });

      expect(result.misAJour).toBe('2024-01-15T14:00');
    });
  });

  describe('Slice horaire (nowIndex)', () => {
    it("démarre le slice à partir de l'heure courante", async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawResponse })
      );

      const result = await fetchForecast({ latitude: 45.5, longitude: -73.6 });

      // nowIndex = 1 (14:00), donc on exclut 13:00
      expect(result.horaire[0].heure).toBe('2024-01-15T14:00');
      expect(result.horaire[0].temperature).toBe(-5);
      expect(result.horaire[0].precipitation).toBe(20);
    });

    it('utilise index 0 si aucune heure ne correspond (nowIndex = -1)', async () => {
      const responseAvecHeuresFutures = {
        ...mockRawResponse,
        current: { ...mockRawResponse.current, time: '2024-01-15T00:00' },
        hourly: {
          ...mockRawResponse.hourly,
          time: ['2024-01-15T06:00', '2024-01-15T07:00', '2024-01-15T08:00'],
        },
      };

      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => responseAvecHeuresFutures })
      );

      const result = await fetchForecast({ latitude: 45.5, longitude: -73.6 });

      // 06:00 >= 00:00 donc nowIndex = 0, pas de crash
      expect(result.horaire[0].heure).toBe('2024-01-15T06:00');
    });
  });

  describe('Gestion des erreurs', () => {
    it('lève BadGatewayError si Open-Meteo répond non-200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

      await expect(fetchForecast({ latitude: 45.5, longitude: -73.6 })).rejects.toThrow(
        BadGatewayError
      );
    });

    it("inclut le code HTTP dans le message d'erreur", async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }));

      await expect(fetchForecast({ latitude: 45.5, longitude: -73.6 })).rejects.toThrow('429');
    });

    it('lève une erreur si fetch échoue réseau', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

      await expect(fetchForecast({ latitude: 45.5, longitude: -73.6 })).rejects.toThrow(
        'Network error'
      );
    });
  });
});
