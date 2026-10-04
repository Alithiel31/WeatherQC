import { describe, it, expect } from 'vitest';
import { geocodeNomVille } from '../../src/services/geocode.service.js';
import { NotFoundError } from '../../src/lib/errors.js';

// ⚠️ Ces tests interrogent réellement l'API de géocodage Open-Meteo — ils sont
// exclus de `npm run test:run` et tournent via `npm run test:contract`
// (workflow nocturne `contract.yml`). Leur rôle : détecter une dérive du
// contrat que les fixtures ne verraient pas.
describe('Contrat Open-Meteo Geocoding (réseau réel)', () => {
  it('géocode Montréal au Québec', async () => {
    const lieu = await geocodeNomVille('Montreal');

    expect(lieu.rta).toBe('');
    expect(typeof lieu.nom).toBe('string');
    expect(lieu.nom.length).toBeGreaterThan(0);
    // Boîte englobante large autour de Montréal — on valide le contrat, pas la précision.
    expect(lieu.latitude).toBeGreaterThan(44);
    expect(lieu.latitude).toBeLessThan(47);
    expect(lieu.longitude).toBeGreaterThan(-75);
    expect(lieu.longitude).toBeLessThan(-72);
  });

  it('lève NotFoundError pour une ville qui n’existe pas', async () => {
    await expect(geocodeNomVille('Villequinexistepasqcweather')).rejects.toThrow(NotFoundError);
  });
});
