import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Horaire from '../../src/lib/Horaire.svelte';
import type { PrevisionsHoraires } from '../../src/lib/types.ts';

function heure(
  h: number,
  reste: Partial<PrevisionsHoraires> = {},
  jour = '2026-08-03'
): PrevisionsHoraires {
  return {
    heure: `${jour}T${String(h).padStart(2, '0')}:00`,
    temperature: 21.4,
    code: 0,
    precipitation: 0,
    ...reste,
  };
}

describe('Horaire', () => {
  it('rend une entrée par heure fournie', () => {
    render(Horaire, { heures: [heure(9), heure(10), heure(11)] });

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('étiquette la première heure « Maint. »', () => {
    render(Horaire, { heures: [heure(9), heure(10)] });

    expect(screen.getByText('Maint.')).toBeTruthy();
    expect(screen.getByText('10 h')).toBeTruthy();
  });

  it('remplace minuit par le jour de la semaine', () => {
    render(Horaire, { heures: [heure(23), heure(0, {}, '2026-08-04')] });

    expect(screen.getByText('mar.')).toBeTruthy();
  });

  it('arrondit la température', () => {
    render(Horaire, { heures: [heure(9, { temperature: 21.6 })] });

    expect(screen.getByText('22°')).toBeTruthy();
  });

  it('affiche la probabilité de précipitation à partir de 20 %', () => {
    render(Horaire, {
      heures: [heure(9, { precipitation: 20 }), heure(10, { precipitation: 19 })],
    });

    expect(screen.getByText('20 %')).toBeTruthy();
    expect(screen.queryByText('19 %')).toBeNull();
  });

  it('se rend sans erreur sans aucune heure', () => {
    render(Horaire);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

/** Voir `Quotidien.test.ts` : Open-Meteo laisse des `null` en fin de série. */
describe('Horaire — échéances sans donnée', () => {
  const vide = { temperature: null, code: null, precipitation: null };

  it('n’affiche jamais « 0° » à la place d’une température absente', () => {
    render(Horaire, { heures: [heure(9), heure(10, vide)] });

    expect(screen.queryByText('0°')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('rend l’échéance malgré tout, avec l’icône de repli', () => {
    render(Horaire, { heures: [heure(9, vide)] });

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('❔')).toBeTruthy();
  });

  it('n’affiche pas de probabilité de précipitation absente', () => {
    render(Horaire, { heures: [heure(9, vide)] });

    expect(screen.queryByText(/%/)).toBeNull();
  });
});
