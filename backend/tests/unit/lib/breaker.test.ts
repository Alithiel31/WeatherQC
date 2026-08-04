import { describe, it, expect } from 'vitest';
import {
  autoriserAppel,
  signalerEchec,
  signalerSucces,
  etatDisjoncteurs,
  CircuitOuvertError,
} from '../../../src/lib/breaker.js';
import { config } from '../../../src/config.js';

// Les disjoncteurs sont réinitialisés avant chaque test par `tests/setup.ts`.
const SEUIL = config.breaker.seuilEchecs;

function faireTomber(service: string): void {
  for (let i = 0; i < SEUIL; i++) {
    autoriserAppel(service);
    signalerEchec(service);
  }
}

describe('Disjoncteur', () => {
  it('laisse passer tant que rien n’a échoué', () => {
    expect(autoriserAppel('Open-Meteo')).toBe(true);
    expect(etatDisjoncteurs()['Open-Meteo'].etat).toBe('ferme');
  });

  it('tolère des échecs isolés sous le seuil', () => {
    for (let i = 0; i < SEUIL - 1; i++) {
      autoriserAppel('Open-Meteo');
      signalerEchec('Open-Meteo');
    }

    expect(autoriserAppel('Open-Meteo')).toBe(true);
    expect(etatDisjoncteurs()['Open-Meteo'].etat).toBe('ferme');
  });

  it('remet le compteur à zéro dès un succès', () => {
    for (let i = 0; i < SEUIL - 1; i++) {
      autoriserAppel('Open-Meteo');
      signalerEchec('Open-Meteo');
    }
    signalerSucces('Open-Meteo');

    // Une panne passagère ne doit pas s'accumuler avec la suivante.
    expect(etatDisjoncteurs()['Open-Meteo'].echecsConsecutifs).toBe(0);
  });

  it('s’ouvre au seuil et refuse les appels suivants', () => {
    faireTomber('Open-Meteo');

    expect(etatDisjoncteurs()['Open-Meteo'].etat).toBe('ouvert');
    // C'est tout l'intérêt : un amont mort coûtait ~10 s de connexion tenue par
    // requête, multipliés par le nombre de clients.
    expect(autoriserAppel('Open-Meteo')).toBe(false);
  });

  it('n’affecte pas les autres amonts', () => {
    faireTomber('Open-Meteo');

    expect(autoriserAppel('Zippopotam')).toBe(true);
  });

  it('laisse passer une requête de test après le repos', async () => {
    faireTomber('Open-Meteo');
    // On avance le temps en manipulant le repos plutôt qu'en attendant 30 s.
    await new Promise((r) => setTimeout(r, 0));
    const reouverture = Date.now() + config.breaker.reposMs;
    expect(Date.now()).toBeLessThan(reouverture);

    // Simule la fin du repos : l'implémentation compare à `Date.now()`.
    const vraiNow = Date.now;
    Date.now = () => vraiNow() + config.breaker.reposMs + 1;
    try {
      expect(autoriserAppel('Open-Meteo')).toBe(true);
      expect(etatDisjoncteurs()['Open-Meteo'].etat).toBe('demi-ouvert');
      // Une seule à la fois : les autres attendent le verdict.
      expect(autoriserAppel('Open-Meteo')).toBe(false);
    } finally {
      Date.now = vraiNow;
    }
  });

  it('se referme quand la requête de test réussit', () => {
    faireTomber('Open-Meteo');
    const vraiNow = Date.now;
    Date.now = () => vraiNow() + config.breaker.reposMs + 1;
    try {
      autoriserAppel('Open-Meteo');
      signalerSucces('Open-Meteo');
    } finally {
      Date.now = vraiNow;
    }

    expect(etatDisjoncteurs()['Open-Meteo'].etat).toBe('ferme');
    expect(autoriserAppel('Open-Meteo')).toBe(true);
  });

  it('rouvre immédiatement si la requête de test échoue', () => {
    faireTomber('Open-Meteo');
    const vraiNow = Date.now;
    Date.now = () => vraiNow() + config.breaker.reposMs + 1;
    try {
      autoriserAppel('Open-Meteo');
      signalerEchec('Open-Meteo');
      // Le service n'est pas revenu : inutile de repartir pour un tour complet.
      expect(etatDisjoncteurs()['Open-Meteo'].etat).toBe('ouvert');
      expect(autoriserAppel('Open-Meteo')).toBe(false);
    } finally {
      Date.now = vraiNow;
    }
  });
});

describe('CircuitOuvertError', () => {
  it('est un 503, pas un 502', () => {
    const erreur = new CircuitOuvertError('Open-Meteo');

    // Rien n'a été demandé au fournisseur : c'est notre propre protection qui
    // répond, d'où « service indisponible » plutôt que « mauvaise passerelle ».
    expect(erreur.status).toBe(503);
    expect(erreur.message).toContain('Open-Meteo');
  });
});
