import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { lireTexte, lireJSON, ecrire, ecrireJSON, supprimer } from '../../src/lib/stockage.ts';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Simule un stockage refusé par le navigateur (Safari privé, cookies bloqués). */
function stockageRefuse() {
  const refus = () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refus);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refus);
  vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(refus);
}

describe('lireTexte', () => {
  it('retourne la valeur stockée', () => {
    localStorage.setItem('selection', 'quebec');

    expect(lireTexte('selection', 'montreal')).toBe('quebec');
  });

  it('retourne le défaut quand la clé est absente', () => {
    expect(lireTexte('selection', 'montreal')).toBe('montreal');
  });

  it('retourne une chaîne vide sans défaut explicite', () => {
    expect(lireTexte('codePostal')).toBe('');
  });

  it('retourne le défaut quand le stockage est refusé', () => {
    stockageRefuse();

    expect(lireTexte('selection', 'montreal')).toBe('montreal');
  });
});

describe('lireJSON', () => {
  it('désérialise la valeur stockée', () => {
    localStorage.setItem('lieuCP', JSON.stringify({ rta: 'H2X' }));

    expect(lireJSON('lieuCP', null)).toEqual({ rta: 'H2X' });
  });

  it('retourne le défaut quand la clé est absente', () => {
    expect(lireJSON('lieuCP', null)).toBeNull();
  });

  // Régression : `JSON.parse` jetait pendant l'initialisation du composant,
  // donc avant le premier rendu — la page restait blanche définitivement.
  it('retourne le défaut sur une valeur corrompue', () => {
    localStorage.setItem('lieuCP', '{cassé');

    expect(lireJSON('lieuCP', null)).toBeNull();
  });

  it('purge la valeur corrompue pour ne pas repayer l’échec au démarrage suivant', () => {
    localStorage.setItem('lieuCP', '{cassé');

    lireJSON('lieuCP', null);

    expect(localStorage.getItem('lieuCP')).toBeNull();
  });

  it('retourne le défaut quand le stockage est refusé', () => {
    stockageRefuse();

    expect(lireJSON('lieuCP', null)).toBeNull();
  });
});

describe('ecrire / ecrireJSON', () => {
  it('écrit une chaîne', () => {
    ecrire('selection', 'quebec');

    expect(localStorage.getItem('selection')).toBe('quebec');
  });

  it('sérialise avant d’écrire', () => {
    ecrireJSON('lieuCP', { rta: 'H2X' });

    expect(localStorage.getItem('lieuCP')).toBe('{"rta":"H2X"}');
  });

  it('avale un quota dépassé sans interrompre l’appelant', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });

    expect(() => ecrire('selection', 'quebec')).not.toThrow();
    expect(() => ecrireJSON('lieuCP', { rta: 'H2X' })).not.toThrow();
  });
});

describe('supprimer', () => {
  it('retire la clé', () => {
    localStorage.setItem('lieuCP', '{}');

    supprimer('lieuCP');

    expect(localStorage.getItem('lieuCP')).toBeNull();
  });

  it('avale un stockage refusé', () => {
    stockageRefuse();

    expect(() => supprimer('lieuCP')).not.toThrow();
  });
});
