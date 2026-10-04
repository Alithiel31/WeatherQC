import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import BandeauAlerte from '../../src/lib/BandeauAlerte.svelte';
import type { Alerte } from '../../src/lib/types.ts';

const alertePluie: Alerte = {
  type: 'precipitation',
  importante: false,
  titre: 'Pluie imminente · Montréal',
  corps: 'Probabilité de 75 % vers 16 h.',
};

const alerteVerglas: Alerte = {
  type: 'verglas',
  importante: true,
  titre: 'Risque de verglas · Montréal',
  corps: 'Pluie ou bruine verglaçante prévue vers 16 h. Prudence sur la route.',
};

describe('BandeauAlerte', () => {
  it('ne rend rien sans alerte', () => {
    const { container } = render(BandeauAlerte, { alertes: [] });

    expect(container.querySelector('.alerte')).toBeNull();
  });

  it('ne rend rien quand la prop est omise', () => {
    const { container } = render(BandeauAlerte);

    expect(container.querySelector('.alerte')).toBeNull();
  });

  it('affiche le titre et le corps de la première alerte', () => {
    render(BandeauAlerte, { alertes: [alertePluie] });

    expect(screen.getByText('Pluie imminente · Montréal')).toBeTruthy();
    expect(screen.getByText('Probabilité de 75 % vers 16 h.')).toBeTruthy();
  });

  it('affiche seulement la première alerte quand il y en a plusieurs', () => {
    render(BandeauAlerte, { alertes: [alerteVerglas, alertePluie] });

    expect(screen.getByText('Risque de verglas · Montréal')).toBeTruthy();
    expect(screen.queryByText('Pluie imminente · Montréal')).toBeNull();
  });

  it('utilise role="alert" pour une alerte importante', () => {
    render(BandeauAlerte, { alertes: [alerteVerglas] });

    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('utilise role="status" pour une alerte non importante', () => {
    render(BandeauAlerte, { alertes: [alertePluie] });

    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
