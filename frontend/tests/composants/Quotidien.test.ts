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

  it('convertit les températures en Fahrenheit quand l’unité est impériale', () => {
    render(Quotidien, { jours: [jour('2026-08-03', { min: 0, max: 100 })], unite: 'imperial' });

    expect(screen.getByText('32°')).toBeTruthy();
    expect(screen.getByText('212°')).toBeTruthy();
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

/**
 * Open-Meteo laisse des `null` en fin de série, au-delà de la portée du modèle.
 * Le frontend les déclarait non-nullables : `Math.round(null)` valant `0`, une
 * échéance sans donnée s'affichait « 0° » — indiscernable d'un vrai zéro.
 */
describe('Quotidien — journées sans donnée', () => {
  const vide = { min: null, max: null, code: null, precipitation: null };

  it('n’affiche jamais « 0° » à la place d’une température absente', () => {
    render(Quotidien, { jours: [jour('2026-08-03', vide)] });

    expect(screen.queryByText('0°')).toBeNull();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('ne dessine aucune barre sans les deux bornes', () => {
    render(Quotidien, {
      jours: [jour('2026-08-03', vide), jour('2026-08-04', { min: 12, max: null })],
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(document.querySelectorAll('.plage')).toHaveLength(0);
  });

  it('garde l’échelle de la semaine quand une journée sans donnée la termine', () => {
    // Le vrai coût du bug : `Math.min` comptait ce `null` pour `0` et faussait
    // les barres de *toutes* les journées, pas seulement celle sans donnée.
    const { container: sans } = render(Quotidien, { jours: semaine });
    const { container: avec } = render(Quotidien, {
      jours: [...semaine, jour('2026-08-06', vide)],
    });

    const barres = (c: HTMLElement) =>
      [...c.querySelectorAll('.plage')].map((b) => (b as HTMLElement).style.cssText);

    // Sans quoi l'égalité serait celle de deux listes vides.
    expect(barres(sans)).toHaveLength(semaine.length);
    expect(barres(avec)).toEqual(barres(sans));
  });

  it('n’affiche pas de probabilité de précipitation absente', () => {
    render(Quotidien, { jours: [jour('2026-08-03', vide)] });

    expect(screen.queryByText(/%/)).toBeNull();
  });

  it('se rend quand la semaine entière est sans donnée', () => {
    // Cas limite du repli : filtrer tous les nulls laisse une série vide, et
    // `Math.min()` sans argument rend `Infinity` — les bornes doivent rester finies.
    render(Quotidien, { jours: [jour('2026-08-03', vide), jour('2026-08-04', vide)] });

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(document.querySelectorAll('.plage')).toHaveLength(0);
  });
});
