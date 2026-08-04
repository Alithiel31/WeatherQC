import { describe, it, expect, beforeEach } from 'vitest';
import { creerPreferences } from '../../src/lib/preferences.svelte.ts';
import type { LieuCP } from '../../src/lib/types.ts';

const lieu: LieuCP = {
  rta: 'H2X',
  nom: 'Montréal',
  province: 'Quebec',
  latitude: 45.5088,
  longitude: -73.5878,
};

beforeEach(() => {
  localStorage.clear();
});

describe('creerPreferences — valeurs mémorisées', () => {
  it('relit une sélection et un lieu cohérents', () => {
    localStorage.setItem('selection', 'cp');
    localStorage.setItem('lieuCP', JSON.stringify(lieu));
    localStorage.setItem('codePostal', 'H2X 1Y4');

    const prefs = creerPreferences();

    expect(prefs.selection).toBe('cp');
    expect(prefs.lieuCP).toEqual(lieu);
    expect(prefs.codePostal).toBe('H2X 1Y4');
  });

  it('retombe sur Montréal quand rien n’est mémorisé', () => {
    const prefs = creerPreferences();

    expect(prefs.selection).toBe('montreal');
    expect(prefs.lieuCP).toBeNull();
  });
});

/**
 * `selection` et `lieuCP` étaient relues indépendamment, sans vérifier que la
 * première a un sens sans la seconde. Un `lieuCP` illisible laissait
 * `selection` à `'cp'` : l'application démarrait sur `previsionsVille('cp')`,
 * donc un 404, et l'onglet correspondant n'était même pas rendu — aucun moyen
 * d'en sortir sans vider le stockage à la main.
 */
describe('creerPreferences — invariant selection ⇒ lieuCP', () => {
  it('rétablit la ville par défaut quand le lieu est illisible', () => {
    localStorage.setItem('selection', 'cp');
    localStorage.setItem('lieuCP', '{cassé');

    const prefs = creerPreferences();

    expect(prefs.lieuCP).toBeNull();
    expect(prefs.selection).toBe('montreal');
  });

  it('rétablit la ville par défaut quand le lieu est absent', () => {
    localStorage.setItem('selection', 'cp');

    expect(creerPreferences().selection).toBe('montreal');
  });

  it('répare le stockage plutôt que de recommencer à chaque démarrage', () => {
    localStorage.setItem('selection', 'cp');
    localStorage.setItem('lieuCP', '{cassé');

    creerPreferences();

    expect(localStorage.getItem('selection')).toBe('montreal');
    expect(localStorage.getItem('lieuCP')).toBeNull();
  });

  it('n’écrit rien quand la sélection est déjà cohérente', () => {
    localStorage.setItem('selection', 'quebec');

    const prefs = creerPreferences();

    expect(prefs.selection).toBe('quebec');
    expect(localStorage.getItem('selection')).toBe('quebec');
  });
});

/**
 * `lireJSON` garantit du JSON analysable, pas du JSON conforme : une valeur
 * valide mais étrangère partait chez le backend en `lat=undefined&lon=undefined`
 * — 400 côté serveur, « undefined (undefined) » à l'écran.
 */
describe('creerPreferences — forme du lieu mémorisé', () => {
  it.each([
    ['un objet sans les champs attendus', { a: 1 }],
    ['des coordonnées textuelles', { ...lieu, latitude: '45.5' }],
    ['des coordonnées absentes', { rta: 'H2X', nom: 'Montréal', province: 'Quebec' }],
    ['un NaN glissé dans les coordonnées', { ...lieu, longitude: NaN }],
    ['une valeur qui n’est pas un objet', 'H2X'],
    ['un tableau', []],
  ])('rejette %s', (_cas, valeur) => {
    localStorage.setItem('selection', 'cp');
    localStorage.setItem('lieuCP', JSON.stringify(valeur));

    const prefs = creerPreferences();

    expect(prefs.lieuCP).toBeNull();
    expect(prefs.selection).toBe('montreal');
  });

  it('accepte un lieu conforme portant des champs supplémentaires', () => {
    // Tolérance volontaire : un champ ajouté par une version ultérieure ne doit
    // pas invalider une préférence par ailleurs utilisable.
    localStorage.setItem('lieuCP', JSON.stringify({ ...lieu, pays: 'Canada' }));

    expect(creerPreferences().lieuCP).toMatchObject(lieu);
  });
});

describe('creerPreferences — mutations', () => {
  it('mémorise la ville choisie', () => {
    const prefs = creerPreferences();

    prefs.choisirVille('quebec');

    expect(prefs.selection).toBe('quebec');
    expect(localStorage.getItem('selection')).toBe('quebec');
  });

  it('mémorise un lieu géocodé et la saisie qui l’a produit', () => {
    const prefs = creerPreferences();

    prefs.retenirLieu(lieu, 'H2X 1Y4');

    expect(prefs.selection).toBe('cp');
    expect(prefs.lieuCP).toEqual(lieu);
    expect(localStorage.getItem('codePostal')).toBe('H2X 1Y4');
    expect(JSON.parse(localStorage.getItem('lieuCP')!)).toEqual(lieu);
  });

  it('ne persiste pas la saisie à la frappe', () => {
    const prefs = creerPreferences();

    prefs.codePostal = 'H2X';

    expect(prefs.codePostal).toBe('H2X');
    expect(localStorage.getItem('codePostal')).toBeNull();
  });
});

describe('creerPreferences — unité', () => {
  it('retombe sur le métrique quand rien n’est mémorisé', () => {
    expect(creerPreferences().unite).toBe('metrique');
  });

  it('relit une unité mémorisée valide', () => {
    localStorage.setItem('unite', 'imperial');

    expect(creerPreferences().unite).toBe('imperial');
  });

  it('retombe sur le métrique quand la valeur mémorisée est étrangère', () => {
    localStorage.setItem('unite', 'yolo');

    expect(creerPreferences().unite).toBe('metrique');
  });

  it('bascule et mémorise l’unité', () => {
    const prefs = creerPreferences();

    prefs.basculerUnite();

    expect(prefs.unite).toBe('imperial');
    expect(localStorage.getItem('unite')).toBe('imperial');

    prefs.basculerUnite();

    expect(prefs.unite).toBe('metrique');
    expect(localStorage.getItem('unite')).toBe('metrique');
  });
});
