import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Quotidien from '../../src/lib/Quotidien.svelte';
import type { PrevisionsQuotidiennes } from '../../src/lib/types.ts';

function jour(date: string, reste: Partial<PrevisionsQuotidiennes> = {}): PrevisionsQuotidiennes {
  return {
    date,
    code: 0,
    max: 24,
    min: 14,
    precipitation: 0,
    lever: `${date}T05:30`,
    coucher: `${date}T20:15`,
    ...reste,
  };
}

const semaine = [
  jour('2026-08-03', { min: 14, max: 24 }),
  jour('2026-08-04', { min: 16, max: 27, code: 61, precipitation: 40 }),
  jour('2026-08-05', { min: 12, max: 20, precipitation: 10 }),
];

describe('Quotidien', () => {
  it('rend une ligne par jour fourni', () => {
    render(Quotidien, { jours: semaine });

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('étiquette le premier jour « Auj. » et les suivants en abrégé', () => {
    render(Quotidien, { jours: semaine });

    expect(screen.getByText('Auj.')).toBeTruthy();
    expect(screen.getByText('mar.')).toBeTruthy();
    expect(screen.getByText('mer.')).toBeTruthy();
  });

  it('décrit la météo du jour dans le libellé accessible de l’icône', () => {
    render(Quotidien, { jours: semaine });

    expect(screen.getByLabelText('mardi 4 : Pluie légère')).toBeTruthy();
  });

  it('arrondit les températures min et max', () => {
    render(Quotidien, { jours: [jour('2026-08-03', { min: 13.6, max: 24.4 })] });

    expect(screen.getByText('14°')).toBeTruthy();
    expect(screen.getByText('24°')).toBeTruthy();
  });

  it('affiche la probabilité de précipitation à partir de 20 %', () => {
    render(Quotidien, { jours: semaine });

    expect(screen.getByText('40 %')).toBeTruthy();
    expect(screen.queryByText('10 %')).toBeNull();
  });

  it('ne produit pas de barre dégénérée quand tous les jours ont la même plage', () => {
    // min === max sur la semaine : le diviseur est plancherisé à 1 plutôt que 0.
    render(Quotidien, { jours: [jour('2026-08-03', { min: 20, max: 20 })] });

    const barre = document.querySelector('.plage') as HTMLElement;
    expect(barre.style.left).toBe('0%');
    expect(barre.style.width).toBe('0%');
  });

  it('se rend sans erreur sans aucun jour', () => {
    render(Quotidien);

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});
