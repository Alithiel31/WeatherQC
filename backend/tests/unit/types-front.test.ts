import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CHEMIN_SORTIE, genererTypesFront } from '../../scripts/generer-types-front.js';

/**
 * `frontend/src/lib/api-genere.ts` est versionné : le frontend se construit
 * sans le backend. Ce test fait échouer la CI quand un schéma de
 * `openapi-reponses.ts` change sans que le fichier ait été régénéré — c'est
 * exactement l'écart silencieux que la génération doit empêcher.
 */
describe('types générés pour le frontend', () => {
  it('sont à jour avec les schémas de réponse', async () => {
    const attendu = await genererTypesFront();
    const versionne = readFileSync(CHEMIN_SORTIE, 'utf8');

    expect(
      versionne,
      'frontend/src/lib/api-genere.ts est périmé — lancer `npm run types:front` depuis backend/'
    ).toBe(attendu);
  });
});
