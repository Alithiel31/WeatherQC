import { describe, it, expect } from 'vitest';
import {
  descriptionMeteo,
  iconeMeteo,
  degres,
  familleMeteo,
  jourCourt,
  jourLong,
  heureCourte,
  heureMinute,
  VALEUR_ABSENTE,
} from '../../src/lib/meteo.ts';

describe('descriptionMeteo', () => {
  it('traduit un code WMO connu', () => {
    expect(descriptionMeteo(0)).toBe('Ciel dégagé');
    expect(descriptionMeteo(95)).toBe('Orage');
  });

  it('retombe sur un libellé neutre pour un code inconnu', () => {
    expect(descriptionMeteo(999)).toBe('Conditions inconnues');
  });

  it('retombe sur un libellé neutre quand Open-Meteo n’a pas de code', () => {
    expect(descriptionMeteo(null)).toBe('Conditions inconnues');
  });
});

describe('iconeMeteo', () => {
  it('rend l’icône de jour par défaut', () => {
    expect(iconeMeteo(0)).toBe('☀️');
  });

  it('rend l’icône de nuit quand jour vaut false', () => {
    expect(iconeMeteo(0, false)).toBe('🌙');
  });

  it('rend la même icône jour et nuit quand le code n’en distingue pas', () => {
    expect(iconeMeteo(95, true)).toBe(iconeMeteo(95, false));
  });

  it('retombe sur ❔ pour un code inconnu', () => {
    expect(iconeMeteo(999)).toBe('❔');
    expect(iconeMeteo(999, false)).toBe('❔');
  });

  it('retombe sur ❔ quand Open-Meteo n’a pas de code', () => {
    expect(iconeMeteo(null)).toBe('❔');
    expect(iconeMeteo(null, false)).toBe('❔');
  });
});

describe('degres', () => {
  it('arrondit une température au degré', () => {
    expect(degres(21.4)).toBe('21°');
    expect(degres(21.6)).toBe('22°');
    expect(degres(-3.5)).toBe('-3°');
  });

  it('rend un vrai zéro comme tel', () => {
    expect(degres(0)).toBe('0°');
  });

  it('rend une valeur absente sans jamais l’afficher comme 0°', () => {
    // C'est tout le bug : `Math.round(null)` vaut 0, et « 0° » est une
    // température parfaitement plausible en hiver québécois.
    expect(degres(null)).toBe(VALEUR_ABSENTE);
    expect(degres(null)).not.toContain('0');
  });
});

describe('familleMeteo', () => {
  // La famille pilote le dégradé d'arrière-plan : chaque code doit tomber
  // dans une classe CSS existante.
  it.each([
    [0, 'degage'],
    [1, 'degage'],
    [2, 'nuageux'],
    [3, 'nuageux'],
    [45, 'brouillard'],
    [48, 'brouillard'],
    [71, 'neige'],
    [77, 'neige'],
    [85, 'neige'],
    [86, 'neige'],
    [95, 'orage'],
    [99, 'orage'],
    [61, 'pluie'],
    [80, 'pluie'],
  ])('classe le code %i en « %s »', (code, famille) => {
    expect(familleMeteo(code)).toBe(famille);
  });

  it('classe un code inconnu en pluie', () => {
    expect(familleMeteo(42)).toBe('pluie');
  });
});

describe('jourCourt', () => {
  it('rend l’abréviation française du jour de la semaine', () => {
    // 2026-08-03 est un lundi.
    expect(jourCourt('2026-08-03')).toBe('lun.');
    expect(jourCourt('2026-08-09')).toBe('dim.');
  });

  it('ne décale pas de jour sur un fuseau à l’ouest de UTC', () => {
    // La date est lue à midi local, précisément pour éviter ce décalage.
    expect(jourCourt('2026-01-01')).toBe('jeu.');
  });
});

describe('jourLong', () => {
  it('rend le jour en toutes lettres suivi du quantième', () => {
    expect(jourLong('2026-08-03')).toBe('lundi 3');
  });
});

describe('heureCourte', () => {
  it('rend l’heure locale suivie de « h »', () => {
    const iso = new Date(2026, 7, 3, 14, 30).toISOString();
    expect(heureCourte(iso)).toBe('14 h');
  });
});

describe('heureMinute', () => {
  it('rend l’heure et les minutes séparées par « h »', () => {
    const iso = new Date(2026, 7, 3, 14, 5).toISOString();
    expect(heureMinute(iso)).toBe('14 h 05');
  });

  it('complète les minutes sur deux chiffres', () => {
    const iso = new Date(2026, 7, 3, 9, 0).toISOString();
    expect(heureMinute(iso)).toBe('9 h 00');
  });
});
