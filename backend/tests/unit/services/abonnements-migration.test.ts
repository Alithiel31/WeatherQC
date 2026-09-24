import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ouvrirAbonnements,
  fermerAbonnements,
  ajouterAbonnement,
  abonnementsParVille,
} from '../../../src/services/abonnements.service.js';

// Seul test du fichier à ne pas utiliser `:memory:` (voir tests/setup.ts) :
// l'idempotence de la migration ne peut se vérifier que sur un fichier réel,
// rouvert une seconde fois — un `:memory:` n'a par définition rien à retrouver.
describe('migration des colonnes de seuils', () => {
  let dossier: string | null = null;

  afterEach(() => {
    fermerAbonnements();
    if (dossier) rmSync(dossier, { recursive: true, force: true });
    dossier = null;
  });

  it('ajoute les colonnes une fois, et une seconde ouverture ne perd aucune donnée', () => {
    dossier = mkdtempSync(join(tmpdir(), 'wqc-migration-'));
    const chemin = join(dossier, 'abonnements.sqlite');

    ouvrirAbonnements(chemin);
    ajouterAbonnement({
      ville: 'montreal',
      endpoint: 'https://push/1',
      p256dh: 'p1',
      auth: 'a1',
      seuils: { rafales: 40 },
    });
    fermerAbonnements();

    // Seconde ouverture sur le même fichier : la migration doit être un no-op.
    expect(() => ouvrirAbonnements(chemin)).not.toThrow();

    const abonnements = abonnementsParVille('montreal');
    expect(abonnements).toHaveLength(1);
    expect(abonnements[0].seuils).toEqual({ rafales: 40 });
  });
});
