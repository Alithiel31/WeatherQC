import { describe, it, expect } from 'vitest';
import { fetchForecast } from '../../src/services/openmeteo.service.js';

// ⚠️ Ces tests interrogent réellement Open-Meteo — ils sont exclus de `npm run test:run`
// et tournent via `npm run test:contract` (workflow nocturne `contract.yml`).
// Leur rôle : détecter une dérive du contrat de l'API que les fixtures ne verraient pas.
describe('Contrat Open-Meteo (réseau réel)', () => {
  it('retourne des prévisions exploitables pour Montréal', async () => {
    const previsions = await fetchForecast({ latitude: 45.5019, longitude: -73.5674 });

    expect(previsions.misAJour).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);

    for (const champ of ['temperature', 'ressenti', 'humidite', 'vent', 'code'] as const) {
      expect(Number.isFinite(previsions.actuel[champ])).toBe(true);
    }
    expect(typeof previsions.actuel.jour).toBe('boolean');

    expect(previsions.horaire).toHaveLength(48);
    for (const heure of previsions.horaire) {
      expect(heure.heure).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      expect(Number.isFinite(heure.temperature)).toBe(true);
      expect(Number.isFinite(heure.code)).toBe(true);
    }

    expect(previsions.quotidien).toHaveLength(7);
    for (const jour of previsions.quotidien) {
      expect(jour.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isFinite(jour.max)).toBe(true);
      expect(Number.isFinite(jour.min)).toBe(true);
      expect(jour.max).toBeGreaterThanOrEqual(jour.min);
      expect(jour.lever).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      expect(jour.coucher).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    }
  });
});
