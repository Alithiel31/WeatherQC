import { describe, it, expect, vi, beforeEach } from 'vitest';
import { geocodeNomVille } from '../../../src/services/geocode.service.js';
import { NotFoundError, BadGatewayError } from '../../../src/lib/errors.js';
import {
  reponseGeocodageMontreal,
  reponseGeocodageSaintJean,
} from '../../fixtures/openmeteo-geocoding.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('geocodeNomVille', () => {
  describe('Réponse valide', () => {
    it('retourne le lieu québécois, en écartant l’homonyme hors province', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue({ ok: true, status: 200, json: async () => reponseGeocodageMontreal })
      );

      const result = await geocodeNomVille('Montreal');

      expect(result.nom).toBe('Montréal');
      expect(result.province).toBe('Québec');
      expect(result.latitude).toBeCloseTo(45.50884);
      expect(result.longitude).toBeCloseTo(-73.58781);
    });

    it('ne renvoie pas de RTA — seul le géocodage par code postal en a un', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue({ ok: true, status: 200, json: async () => reponseGeocodageMontreal })
      );

      const result = await geocodeNomVille('Montreal');

      expect(result.rta).toBe('');
    });

    it('retient la ville la plus peuplée en cas d’homonymie québécoise', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue({ ok: true, status: 200, json: async () => reponseGeocodageSaintJean })
      );

      const result = await geocodeNomVille('Saint-Jean');

      expect(result.nom).toBe('Saint-Jean-sur-Richelieu');
    });
  });

  describe('Aucun résultat', () => {
    it('lève NotFoundError si `results` est absent (aucune correspondance)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })
      );

      await expect(geocodeNomVille('Villeinexistante')).rejects.toThrow(NotFoundError);
    });

    it('lève NotFoundError si aucun résultat n’est au Québec', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({
            results: [
              {
                name: 'Toronto',
                latitude: 43.7,
                longitude: -79.4,
                country_code: 'CA',
                admin1: 'Ontario',
              },
            ],
          }),
        })
      );

      await expect(geocodeNomVille('Toronto')).rejects.toThrow(NotFoundError);
    });
  });

  describe('Gestion des erreurs API', () => {
    it('lève BadGatewayError si statut non-ok', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      await expect(geocodeNomVille('Montreal')).rejects.toThrow(BadGatewayError);
    });

    it('lève BadGatewayError si la réponse ne respecte pas le contrat', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          json: async () => ({ results: [{ name: 'Montréal' }] }),
        })
      );

      await expect(geocodeNomVille('Montreal')).rejects.toThrow(BadGatewayError);
    });
  });
});
