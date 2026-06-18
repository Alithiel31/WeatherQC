import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geocodeRTA } from '../../../src/services/geocode.service.js';
import { NotFoundError, BadGatewayError } from '../../../src/lib/errors.js';

const mockZippopotamResponse = {
  places: [
    {
      'place name': 'Montreal',
      state: 'Quebec',
      latitude: '45.5088',
      longitude: '-73.5878',
    },
  ],
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('geocodeRTA', () => {
  describe('Réponse valide', () => {
    it('retourne un LieuGeocode correctement mappé', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockZippopotamResponse })
      );

      const result = await geocodeRTA('H2X');

      expect(result.rta).toBe('H2X');
      expect(result.nom).toBe('Montreal');
      expect(result.province).toBe('Quebec');
    });

    it('convertit latitude et longitude en nombre (parseFloat)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => mockZippopotamResponse })
      );

      const result = await geocodeRTA('H2X');

      expect(typeof result.latitude).toBe('number');
      expect(typeof result.longitude).toBe('number');
      expect(result.latitude).toBeCloseTo(45.5088);
      expect(result.longitude).toBeCloseTo(-73.5878);
    });
  });

  describe('Gestion des erreurs API', () => {
    it('lève NotFoundError si statut 404', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 404 })
      );

      await expect(geocodeRTA('ZZZ')).rejects.toThrow(NotFoundError);
    });

    it("inclut le RTA dans le message NotFoundError", async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 404 })
      );

      await expect(geocodeRTA('ZZZ')).rejects.toThrow('ZZZ');
    });

    it('lève BadGatewayError si statut non-ok (pas 404)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500 })
      );

      await expect(geocodeRTA('H2X')).rejects.toThrow(BadGatewayError);
    });

    it("inclut le code HTTP dans le message BadGatewayError", async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500 })
      );

      await expect(geocodeRTA('H2X')).rejects.toThrow('500');
    });
  });

  describe('Données manquantes', () => {
    it('lève NotFoundError si places est un tableau vide', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ places: [] }) })
      );

      await expect(geocodeRTA('H2X')).rejects.toThrow(NotFoundError);
    });

    it('lève NotFoundError si places est undefined', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
      );

      await expect(geocodeRTA('H2X')).rejects.toThrow(NotFoundError);
    });
  });
});
