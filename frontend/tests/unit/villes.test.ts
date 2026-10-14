import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { VILLES_REPLI } from '../../src/lib/api.ts';
import { VILLES_AVEC_PHOTO, photoVille } from '../../src/lib/villesPhotos.ts';

/**
 * Les villes vivent à trois endroits : `backend/src/data/cities.ts` (source de
 * vérité), `VILLES_REPLI` (sélecteur hors ligne) et `VILLES_AVEC_PHOTO`
 * (visuels). Rien ne signalait une ville ajoutée au backend sans photo, ni une
 * photo ou un repli visant une ville que le backend ne connaît plus.
 *
 * Le fichier backend est lu comme texte plutôt qu'importé : le frontend n'a ni
 * ses dépendances ni sa configuration TypeScript.
 */
const sourceBackend = readFileSync(
  resolve(__dirname, '../../../backend/src/data/cities.ts'),
  'utf8'
);
const VILLES_BACKEND = [...sourceBackend.matchAll(/^\s+id: '([^']+)',$/gm)].map((m) => m[1]);
const DOSSIER_PHOTOS = resolve(__dirname, '../../public');

describe('cohérence des listes de villes avec le backend', () => {
  it('lit bien les villes du backend', () => {
    // Garde-fou : si le format de `cities.ts` change, l'extraction ne doit pas
    // rendre une liste vide qui ferait passer les tests suivants à vide.
    expect(VILLES_BACKEND.length).toBeGreaterThanOrEqual(2);
    expect(VILLES_BACKEND).toContain('montreal');
  });

  it('chaque ville du backend a un visuel déclaré', () => {
    expect(VILLES_BACKEND.filter((id) => !VILLES_AVEC_PHOTO.has(id))).toEqual([]);
  });

  it('aucun visuel ne vise une ville inconnue du backend', () => {
    expect([...VILLES_AVEC_PHOTO].filter((id) => !VILLES_BACKEND.includes(id))).toEqual([]);
  });

  it('chaque visuel déclaré existe en version jour et nuit', () => {
    const manquants = [...VILLES_AVEC_PHOTO]
      .flatMap((id) => [photoVille(id, false), photoVille(id, true)])
      .filter((chemin) => chemin !== null && !existsSync(resolve(DOSSIER_PHOTOS, `.${chemin}`)));
    expect(manquants).toEqual([]);
  });

  it('le repli hors ligne ne propose que des villes du backend', () => {
    expect(VILLES_REPLI.map((v) => v.id).filter((id) => !VILLES_BACKEND.includes(id))).toEqual([]);
  });
});
