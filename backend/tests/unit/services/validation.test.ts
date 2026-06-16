import { describe, it, expect } from 'vitest';
import {
  previsionsParVilleSchema,
  previsionsCoordonneesSchema,
  geocodeSchema,
} from '../../../src/schemas/validation.js';

describe('Validation Schemas', () => {
  describe('previsionsParVilleSchema', () => {
    it('doit accepter une ville valide', () => {
      const result = previsionsParVilleSchema.parse({ ville: 'MONTREAL' });
      expect(result.ville).toBe('montreal');
    });

    it('doit rejeter une ville vide', () => {
      expect(() => previsionsParVilleSchema.parse({ ville: '' })).toThrow();
    });
  });

  describe('previsionsCoordonneesSchema', () => {
    it('doit convertir strings en nombres', () => {
      const result = previsionsCoordonneesSchema.parse({
        lat: '45.5',
        lon: '-73.6',
      });
      expect(typeof result.lat).toBe('number');
      expect(typeof result.lon).toBe('number');
    });

    it('doit rejeter lat > 90', () => {
      expect(() =>
        previsionsCoordonneesSchema.parse({
          lat: 91,
          lon: -73.6,
        })
      ).toThrow();
    });

    it('doit rejeter lon < -180', () => {
      expect(() =>
        previsionsCoordonneesSchema.parse({
          lat: 45.5,
          lon: -181,
        })
      ).toThrow();
    });

    it('doit utiliser le nom par défaut', () => {
      const result = previsionsCoordonneesSchema.parse({
        lat: 45.5,
        lon: -73.6,
      });
      expect(result.nom).toBe('Position personnalisee');
    });
  });

  describe('geocodeSchema', () => {
    it('doit convertir en majuscules', () => {
      const result = geocodeSchema.parse({ codePostal: 'h2x' });
      expect(result.codePostal).toContain('H2X');
    });

    it('doit rejeter un format invalide', () => {
      expect(() => geocodeSchema.parse({ codePostal: 'INVALID' })).toThrow();
    });
  });
});
