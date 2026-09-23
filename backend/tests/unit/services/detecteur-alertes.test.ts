import { describe, it, expect } from 'vitest';
import {
  detecterAlertes,
  redigerNotification,
  SEUILS_DEFAUT,
  type HeurePrevue,
  type Alerte,
} from '../../../src/services/detecteur-alertes.js';

/** `n` heures calmes à partir de 15 h, modifiables heure par heure. */
function heures(n: number, modif: (i: number) => Partial<HeurePrevue> = () => ({})): HeurePrevue[] {
  return Array.from({ length: n }, (_, i) => ({
    heure: `2026-09-23T${String(15 + i).padStart(2, '0')}:00`,
    temperature: 15,
    code: 1,
    precipitation: 0,
    rafales: 20,
    ...modif(i),
  }));
}

const calme = { temperature: 15, code: 1 };

describe('detecterAlertes', () => {
  it('ne signale rien par temps calme', () => {
    expect(detecterAlertes(calme, heures(8))).toEqual([]);
  });

  it('ne signale rien sans prévisions', () => {
    expect(detecterAlertes(calme, [])).toEqual([]);
  });

  describe('précipitation imminente', () => {
    it('annonce la pluie dans la fenêtre', () => {
      const [alerte] = detecterAlertes(
        calme,
        heures(8, (i) => (i === 1 ? { precipitation: 80, code: 61 } : {}))
      );
      expect(alerte).toEqual({
        type: 'precipitation',
        importante: false,
        heure: '2026-09-23T16:00',
        valeur: 80,
        nature: 'pluie',
      });
    });

    it('distingue la neige', () => {
      const [alerte] = detecterAlertes(
        calme,
        heures(8, (i) => (i === 0 ? { precipitation: 90, code: 73 } : {}))
      );
      expect(alerte?.nature).toBe('neige');
    });

    it('retombe sur « pluie » quand le code manque', () => {
      const [alerte] = detecterAlertes(
        calme,
        heures(8, (i) => (i === 0 ? { precipitation: 90, code: null } : {}))
      );
      expect(alerte?.nature).toBe('pluie');
    });

    it('ignore ce qui dépasse la fenêtre', () => {
      expect(
        detecterAlertes(
          calme,
          heures(8, (i) => (i === 2 ? { precipitation: 95 } : {}))
        )
      ).toEqual([]);
    });

    it.each([
      ['pleut', 61],
      ['neige', 73],
      ['tombe des averses', 81],
      ['y a un orage', 95],
    ])('se tait quand il %s déjà', (_, code) => {
      const alertes = detecterAlertes(
        { temperature: 15, code },
        heures(8, () => ({ precipitation: 95 }))
      );
      expect(alertes.map((a) => a.type)).not.toContain('precipitation');
    });

    it('ignore les probabilités absentes', () => {
      expect(
        detecterAlertes(
          calme,
          heures(8, () => ({ precipitation: null }))
        )
      ).toEqual([]);
    });
  });

  describe('chute de température', () => {
    it("signale une baisse franche, à l'heure la plus froide", () => {
      const [alerte] = detecterAlertes(
        calme,
        heures(8, (i) => ({ temperature: 15 - i * 2 }))
      );
      expect(alerte).toMatchObject({
        type: 'chute-temperature',
        heure: '2026-09-23T20:00',
        valeur: 10,
      });
    });

    it('laisse passer une baisse sous le seuil', () => {
      expect(
        detecterAlertes(
          calme,
          heures(8, (i) => ({ temperature: 15 - i }))
        )
      ).toEqual([]);
    });

    it('ignore les températures absentes', () => {
      expect(
        detecterAlertes(
          calme,
          heures(8, () => ({ temperature: null }))
        )
      ).toEqual([]);
    });
  });

  describe('vent', () => {
    it('annonce le début du coup de vent et son pic', () => {
      const [alerte] = detecterAlertes(
        calme,
        heures(8, (i) => ({ rafales: i === 3 ? 65 : i === 4 ? 85 : 20 }))
      );
      expect(alerte).toMatchObject({ type: 'vent', heure: '2026-09-23T18:00', valeur: 85 });
    });

    it('ignore les rafales absentes', () => {
      expect(
        detecterAlertes(
          calme,
          heures(8, () => ({ rafales: null }))
        )
      ).toEqual([]);
    });

    it('tolère une rafale absente à côté du coup de vent', () => {
      const [alerte] = detecterAlertes(
        calme,
        heures(8, (i) => ({ rafales: i === 0 ? null : i === 1 ? 70 : 20 }))
      );
      expect(alerte).toMatchObject({ type: 'vent', valeur: 70 });
    });
  });

  it.each([
    ['verglas', 66],
    ['orage', 95],
  ] as const)('%s est une alerte importante', (type, code) => {
    const alertes = detecterAlertes(
      calme,
      heures(8, (i) => (i === 4 ? { code } : {}))
    );
    expect(alertes).toContainEqual({
      type,
      importante: true,
      heure: '2026-09-23T19:00',
      valeur: code,
    });
  });

  it('ignore les codes absents pour le verglas et l’orage', () => {
    expect(
      detecterAlertes(
        calme,
        heures(8, () => ({ code: null }))
      )
    ).toEqual([]);
  });

  it('cumule les alertes simultanées, les plus graves en tête', () => {
    const alertes = detecterAlertes(
      calme,
      heures(8, (i) => ({ code: 95, precipitation: 90, rafales: 70, temperature: 15 - i * 2 }))
    );
    expect(alertes.map((a) => a.type)).toEqual([
      'orage',
      'precipitation',
      'chute-temperature',
      'vent',
    ]);
  });

  it('respecte des seuils personnalisés', () => {
    const prevues = heures(8, () => ({ rafales: 45 }));
    expect(detecterAlertes(calme, prevues)).toEqual([]);
    expect(detecterAlertes(calme, prevues, { ...SEUILS_DEFAUT, rafales: 40 })).toHaveLength(1);
  });
});

describe('redigerNotification', () => {
  const base = { importante: false, heure: '2026-09-23T16:00' };

  it.each<[Alerte, string, string]>([
    [
      { ...base, type: 'precipitation', valeur: 80, nature: 'pluie' },
      'Pluie imminente · Montréal',
      'Probabilité de 80 % vers 16 h.',
    ],
    [
      { ...base, type: 'precipitation', valeur: 90, nature: 'neige' },
      'Neige imminente · Montréal',
      'Probabilité de 90 % vers 16 h.',
    ],
    [
      { ...base, type: 'chute-temperature', valeur: 10 },
      'Chute de température · Montréal',
      "Jusqu'à 10 °C de moins vers 16 h.",
    ],
    [
      { ...base, type: 'vent', valeur: 85 },
      'Vents forts · Montréal',
      "Rafales jusqu'à 85 km/h à partir de 16 h.",
    ],
    [
      { ...base, type: 'verglas', valeur: 66, importante: true },
      'Risque de verglas · Montréal',
      'Pluie ou bruine verglaçante prévue vers 16 h. Prudence sur la route.',
    ],
    [
      { ...base, type: 'orage', valeur: 95, importante: true },
      'Orage · Montréal',
      'Orage prévu vers 16 h.',
    ],
  ])('rédige %o', (alerte, titre, corps) => {
    expect(redigerNotification(alerte, 'Montréal')).toEqual({ titre, corps });
  });

  it('écrit « 9 h » et non « 09 h »', () => {
    const alerte: Alerte = {
      ...base,
      heure: '2026-09-24T09:00',
      type: 'orage',
      valeur: 95,
      importante: true,
    };
    expect(redigerNotification(alerte, 'Québec').corps).toBe('Orage prévu vers 9 h.');
  });
});
