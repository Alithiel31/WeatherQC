import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ConditionsActuelles from '../../src/lib/ConditionsActuelles.svelte';
import type { ConditionsActuelles as Conditions } from '../../src/lib/types.ts';

const actuel: Conditions = {
  temperature: 21.4,
  ressenti: 19.8,
  humidite: 62,
  vent: 14.6,
  code: 2,
  jour: true,
};

describe('ConditionsActuelles — unité métrique (par défaut)', () => {
  it('affiche le lieu, la température, la condition et l’icône', () => {
    render(ConditionsActuelles, { actuel, lieu: 'Montréal' });

    expect(screen.getByText('Montréal')).toBeTruthy();
    expect(screen.getByText('21')).toBeTruthy();
    expect(screen.getByText('°C')).toBeTruthy();
    expect(screen.getByText('Partiellement nuageux')).toBeTruthy();
    expect(screen.getByText('⛅')).toBeTruthy();
  });

  it('affiche le ressenti, le vent et l’humidité', () => {
    render(ConditionsActuelles, { actuel, lieu: 'Montréal' });

    expect(screen.getByText('20°')).toBeTruthy();
    expect(screen.getByText('15 km/h')).toBeTruthy();
    expect(screen.getByText('62 %')).toBeTruthy();
  });
});

describe('ConditionsActuelles — unité impériale', () => {
  it('convertit la température et le vent', () => {
    render(ConditionsActuelles, { actuel, lieu: 'Montréal', unite: 'imperial' });

    expect(screen.getByText('71')).toBeTruthy();
    expect(screen.getByText('°F')).toBeTruthy();
    expect(screen.getByText('9 mph')).toBeTruthy();
  });
});

describe('ConditionsActuelles — icône de nuit', () => {
  it('utilise l’icône nocturne quand `jour` est faux', () => {
    render(ConditionsActuelles, { actuel: { ...actuel, jour: false }, lieu: 'Montréal' });

    expect(screen.getByText('☁️')).toBeTruthy();
  });
});
