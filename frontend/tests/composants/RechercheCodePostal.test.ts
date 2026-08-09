import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import RechercheCodePostal from '../../src/lib/RechercheCodePostal.svelte';

function champ() {
  return screen.getByRole('textbox', { name: /Code postal/ });
}

function bouton() {
  return screen.getByRole('button', { name: /Rechercher|Recherche…/ });
}

describe('RechercheCodePostal — soumission', () => {
  it('appelle onrechercher avec la saisie trimée au clic sur le bouton', async () => {
    const user = userEvent.setup();
    const onrechercher = vi.fn();
    render(RechercheCodePostal, { valeur: '  H2X 1Y6  ', erreur: null, onrechercher });

    await user.click(bouton());

    expect(onrechercher).toHaveBeenCalledWith('H2X 1Y6');
  });

  it('appelle onrechercher à la soumission implicite par Entrée', async () => {
    const user = userEvent.setup();
    const onrechercher = vi.fn();
    render(RechercheCodePostal, { valeur: 'K1A 0B1', erreur: null, onrechercher });

    champ().focus();
    await user.keyboard('{Enter}');

    expect(onrechercher).toHaveBeenCalledWith('K1A 0B1');
  });

  it('n’appelle pas onrechercher pour une saisie vide ou blanche', async () => {
    const user = userEvent.setup();
    const onrechercher = vi.fn();
    render(RechercheCodePostal, { valeur: '   ', erreur: null, onrechercher });

    await user.click(bouton());

    expect(onrechercher).not.toHaveBeenCalled();
  });
});

describe('RechercheCodePostal — état « en cours »', () => {
  it('désactive le bouton et change son libellé', () => {
    render(RechercheCodePostal, {
      valeur: 'H2X',
      erreur: null,
      enCours: true,
      onrechercher: vi.fn(),
    });

    const btn = screen.getByRole('button', { name: 'Recherche…' });
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('n’appelle pas onrechercher si une recherche est déjà en cours', async () => {
    const user = userEvent.setup();
    const onrechercher = vi.fn();
    render(RechercheCodePostal, { valeur: 'H2X', erreur: null, enCours: true, onrechercher });

    await user.click(screen.getByRole('button', { name: 'Recherche…' }));

    expect(onrechercher).not.toHaveBeenCalled();
  });
});

describe('RechercheCodePostal — message d’erreur', () => {
  it('affiche le message d’erreur quand fourni', () => {
    render(RechercheCodePostal, {
      valeur: '',
      erreur: 'Code postal introuvable',
      onrechercher: vi.fn(),
    });

    expect(screen.getByRole('alert').textContent).toBe('Code postal introuvable');
  });

  it('n’affiche aucune alerte quand `erreur` est nul', () => {
    render(RechercheCodePostal, { valeur: '', erreur: null, onrechercher: vi.fn() });

    expect(screen.queryByRole('alert')).toBeNull();
  });
});
