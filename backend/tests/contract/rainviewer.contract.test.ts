import { describe, it, expect } from 'vitest';
import { fetchFrames } from '../../src/services/rainviewer.service.js';

// ⚠️ Ces tests interrogent réellement RainViewer — voir `openmeteo.contract.test.ts`.
describe('Contrat RainViewer (réseau réel)', () => {
  it('retourne un index d’images exploitable', async () => {
    const frames = await fetchFrames();

    expect(frames.hote).toMatch(/^https:\/\//);

    // Le radar couvre le monde entier : ces séries ne sont jamais vides. Le
    // satellite peut l'être ponctuellement, on vérifie donc seulement sa forme.
    expect(frames.radar.length).toBeGreaterThan(0);
    expect(frames.radar.length).toBeLessThanOrEqual(12);
    expect(frames.satellite.length).toBeLessThanOrEqual(10);

    for (const image of [...frames.radar, ...frames.satellite]) {
      expect(typeof image.path).toBe('string');
      expect(image.path.length).toBeGreaterThan(0);
      // `time` est un instant Unix en secondes : la carte le multiplie par 1000.
      expect(Number.isInteger(image.time)).toBe(true);
      expect(image.time).toBeGreaterThan(1_700_000_000);
    }
  });

  it('rend les images du radar dans l’ordre chronologique', async () => {
    // L'animation les rejoue dans l'ordre du tableau : un index désordonné
    // ferait défiler le temps à l'envers sans rien casser d'autre.
    const { radar } = await fetchFrames();

    const instants = radar.map((i) => i.time);
    expect(instants).toEqual([...instants].sort((a, b) => a - b));
  });
});
