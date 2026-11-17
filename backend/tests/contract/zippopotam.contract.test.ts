import { describe, it, expect } from 'vitest';
import { geocodeRTA } from '../../src/services/geocode.service.js';
import { appelAmont } from './amont.js';
import { NotFoundError } from '../../src/lib/errors.js';

// ⚠️ Ces tests interrogent réellement Zippopotam — voir `openmeteo.contract.test.ts`.
describe('Contrat Zippopotam (réseau réel)', () => {
  it('géocode la RTA H2X quelque part au Québec', async (ctx) => {
    const lieu = await appelAmont(ctx, () => geocodeRTA('H2X'));

    expect(lieu.rta).toBe('H2X');
    expect(typeof lieu.nom).toBe('string');
    expect(lieu.nom.length).toBeGreaterThan(0);
    expect(lieu.province).toBe('Quebec');
    // Boîte englobante large autour de Montréal — on valide le contrat, pas la précision.
    expect(lieu.latitude).toBeGreaterThan(44);
    expect(lieu.latitude).toBeLessThan(47);
    expect(lieu.longitude).toBeGreaterThan(-75);
    expect(lieu.longitude).toBeLessThan(-72);
  });

  it('lève NotFoundError sur une RTA inexistante', async (ctx) => {
    await expect(appelAmont(ctx, () => geocodeRTA('Z9Z'))).rejects.toThrow(NotFoundError);
  });
});
