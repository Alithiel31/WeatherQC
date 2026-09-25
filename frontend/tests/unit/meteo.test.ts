import { describe, it, expect } from 'vitest';
import {
  descriptionMeteo,
  iconeMeteo,
  degres,
  temperatureArrondie,
  vitesseVent,
  libelleUniteTemp,
  libelleUniteVent,
  familleMeteo,
  jourCourt,
  jourLong,
  heureCourte,
  heureMinute,
  resumeCarte,
  VALEUR_ABSENTE,
} from '../../src/lib/meteo.ts';

function heure(precipitation: number | null, code: number | null = 2) {
  return { heure: '2026-08-03T12:00', code, precipitation };
}

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

  it('rend le métrique par défaut, sans conversion', () => {
    expect(degres(21.4)).toBe(degres(21.4, 'metrique'));
  });

  it('convertit en Fahrenheit quand l’unité est impériale', () => {
    expect(degres(0, 'imperial')).toBe('32°');
    expect(degres(100, 'imperial')).toBe('212°');
    expect(degres(21.4, 'imperial')).toBe('71°');
  });

  it('rend une valeur absente en impérial sans tenter de la convertir', () => {
    expect(degres(null, 'imperial')).toBe(VALEUR_ABSENTE);
  });
});

describe('temperatureArrondie', () => {
  it('arrondit sans signe degré, en métrique par défaut', () => {
    expect(temperatureArrondie(21.6)).toBe(22);
  });

  it('convertit et arrondit en Fahrenheit', () => {
    expect(temperatureArrondie(0, 'imperial')).toBe(32);
  });
});

describe('vitesseVent', () => {
  it('rend le km/h fourni sans conversion par défaut', () => {
    expect(vitesseVent(20)).toBe(20);
    expect(vitesseVent(20)).toBe(vitesseVent(20, 'metrique'));
  });

  it('convertit en mph quand l’unité est impériale', () => {
    expect(vitesseVent(100, 'imperial')).toBe(62);
  });

  it('arrondit au km/h ou au mph près', () => {
    expect(vitesseVent(14.6)).toBe(15);
  });
});

describe('libelleUniteTemp', () => {
  it('rend C en métrique et F en impérial', () => {
    expect(libelleUniteTemp('metrique')).toBe('C');
    expect(libelleUniteTemp('imperial')).toBe('F');
  });
});

describe('libelleUniteVent', () => {
  it('rend km/h en métrique et mph en impérial', () => {
    expect(libelleUniteVent('metrique')).toBe('km/h');
    expect(libelleUniteVent('imperial')).toBe('mph');
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

describe('resumeCarte', () => {
  it('ne signale rien sous le seuil de 20 %, aligné sur celui de la bande horaire', () => {
    expect(resumeCarte([heure(19), heure(0), heure(null)])).toBe(
      'Aucune précipitation significative attendue dans les prochaines heures.'
    );
  });

  it('ne regarde aucune donnée absente', () => {
    expect(resumeCarte([heure(null), heure(null)])).toBe(
      'Aucune précipitation significative attendue dans les prochaines heures.'
    );
  });

  it('signale une précipitation en cours quand l’heure actuelle dépasse le seuil', () => {
    expect(resumeCarte([heure(45, 61)])).toBe('Pluie en cours ou imminente, probabilité de 45 %.');
  });

  it('distingue la neige de la pluie via le code WMO de l’heure la plus probable', () => {
    expect(resumeCarte([heure(45, 73)])).toBe('Neige en cours ou imminente, probabilité de 45 %.');
  });

  it('signale une précipitation à venir quand ce n’est pas l’heure actuelle qui domine', () => {
    expect(resumeCarte([heure(10), heure(60, 61), heure(30)])).toBe(
      'Pluie probable dans les prochaines heures, probabilité de 60 %.'
    );
  });

  it('ne regarde que les trois prochaines heures', () => {
    expect(resumeCarte([heure(0), heure(0), heure(0), heure(90, 61)])).toBe(
      'Aucune précipitation significative attendue dans les prochaines heures.'
    );
  });

  it('retient la probabilité la plus haute, pas la première au-dessus du seuil', () => {
    expect(resumeCarte([heure(25), heure(80, 61)])).toBe(
      'Pluie probable dans les prochaines heures, probabilité de 80 %.'
    );
  });
});
