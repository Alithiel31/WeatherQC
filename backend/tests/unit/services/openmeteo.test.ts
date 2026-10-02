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
    wind_gusts_10m: [25, 35, 45],
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

// Même réponse, enrichie des séries ajoutées pour le tableau de bord.
// `time` compte trois heures : le slice démarre à l'index 1 (14:00).
const mockRawEnrichie = {
  ...mockRawResponse,
  current: { ...mockRawResponse.current, wind_direction_10m: 250, wind_gusts_10m: 38.2 },
  hourly: {
    ...mockRawResponse.hourly,
    apparent_temperature: [-9, -10, -11],
    relative_humidity_2m: [70, 80, 85],
    wind_speed_10m: [15, 20, 25],
    wind_direction_10m: [240, 250, 260],
    precipitation: [0, 0.4, 1.2],
    uv_index: [0.2, 0.6, 0.3],
    snowfall: [0, 0.5, 1.4],
  },
  daily: {
    ...mockRawResponse.daily,
    uv_index_max: [0.9],
    precipitation_sum: [6.4],
    wind_speed_10m_max: [28.1],
    wind_gusts_10m_max: [47],
    snowfall_sum: [5.2],
  },
};

describe('fetchForecast', () => {
  describe('Champs ajoutés pour le tableau de bord', () => {
    it('mappe les conditions actuelles enrichies, UV lu dans la série horaire', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawEnrichie })
      );

      const { actuel } = await fetchForecast({ latitude: 45.5, longitude: -73.6 });

      expect(actuel.directionVent).toBe(250);
      expect(actuel.rafales).toBe(38.2);
      expect(actuel.uv).toBe(0.6); // heure courante (14:00) = index 1 de la série
    });

    it('mappe les séries horaires en les décalant comme les champs existants', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawEnrichie })
      );

      const { horaire } = await fetchForecast({ latitude: 45.5, longitude: -73.6 });

      expect(horaire[0]).toMatchObject({
        heure: '2024-01-15T14:00',
        ressenti: -10,
        humidite: 80,
        vent: 20,
        directionVent: 250,
        precipitationMm: 0.4,
        uv: 0.6,
        neigeCm: 0.5,
      });
      expect(horaire[1].precipitationMm).toBe(1.2);
      expect(horaire[1].neigeCm).toBe(1.4);
    });

    it('mappe les cumuls et maximums quotidiens', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawEnrichie })
      );

      const { quotidien } = await fetchForecast({ latitude: 45.5, longitude: -73.6 });

      expect(quotidien[0]).toMatchObject({
        uvMax: 0.9,
        precipitationMm: 6.4,
        ventMax: 28.1,
        rafalesMax: 47,
        neigeCm: 5.2,
      });
    });

    it("renvoie null — sans échouer — quand Open-Meteo n'envoie pas ces séries", async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawResponse })
      );

      const { actuel, horaire, quotidien } = await fetchForecast({
        latitude: 45.5,
        longitude: -73.6,
      });

      expect(actuel).toMatchObject({ directionVent: null, rafales: null, uv: null });
      expect(horaire[0]).toMatchObject({
        ressenti: null,
        humidite: null,
        vent: null,
        directionVent: null,
        precipitationMm: null,
        uv: null,
        neigeCm: null,
      });
      expect(quotidien[0]).toMatchObject({
        neigeCm: null,
        uvMax: null,
        precipitationMm: null,
        ventMax: null,
        rafalesMax: null,
      });
    });

    it('demande à Open-Meteo les variables correspondantes', async () => {
      const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => mockRawEnrichie });
      vi.stubGlobal('fetch', fetchMock);

      await fetchForecast({ latitude: 45.5, longitude: -73.6 });

      const url = new URL(String(fetchMock.mock.calls[0][0]));
      expect(url.searchParams.get('current')).toContain('wind_direction_10m');
      expect(url.searchParams.get('hourly')).toContain('uv_index');
      expect(url.searchParams.get('hourly')).toContain('precipitation,');
      expect(url.searchParams.get('daily')).toContain('precipitation_sum');
      expect(url.searchParams.get('hourly')).toContain('snowfall');
      expect(url.searchParams.get('daily')).toContain('snowfall_sum');
    });
  });

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
      expect(result.horaire[0].rafales).toBe(35);
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

  // Régression : ces réponses sortaient en TypeError sur `raw.hourly.time`, donc
  // en 500 « Internal server error », alors que la faute est chez le fournisseur.
  describe('Dérive du contrat amont', () => {
    const repondre = (corps: unknown) =>
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => corps })
      );

    it('lève BadGatewayError quand un bloc entier manque', async () => {
      repondre({ current: mockRawResponse.current, daily: mockRawResponse.daily });

      await expect(fetchForecast({ latitude: 45.5, longitude: -73.6 })).rejects.toThrow(
        BadGatewayError
      );
    });

    it('lève BadGatewayError quand une série est renommée', async () => {
      const { temperature_2m, ...reste } = mockRawResponse.hourly;
      repondre({ ...mockRawResponse, hourly: { ...reste, temperature_c: temperature_2m } });

      await expect(fetchForecast({ latitude: 45.5, longitude: -73.6 })).rejects.toThrow(
        BadGatewayError
      );
    });

    it('nomme le champ fautif dans le message', async () => {
      repondre({ ...mockRawResponse, daily: { ...mockRawResponse.daily, sunrise: undefined } });

      await expect(fetchForecast({ latitude: 45.5, longitude: -73.6 })).rejects.toThrow(
        'daily.sunrise'
      );
    });

    it('accepte les valeurs nulles d’une série — Open-Meteo en produit', async () => {
      const nulle = mockRawResponse.hourly.precipitation_probability.map(() => null);
      repondre({
        ...mockRawResponse,
        hourly: { ...mockRawResponse.hourly, precipitation_probability: nulle },
      });

      const previsions = await fetchForecast({ latitude: 45.5, longitude: -73.6 });

      expect(previsions.horaire[0].precipitation).toBeNull();
    });
  });
});
