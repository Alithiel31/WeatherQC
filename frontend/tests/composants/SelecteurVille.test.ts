import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import SelecteurVille from '../../src/lib/SelecteurVille.svelte';
import type { VilleDisponible, LieuCP } from '../../src/lib/types.ts';

const villes: VilleDisponible[] = [
  { id: 'montreal', nom: 'Montréal' },
  { id: 'quebec', nom: 'Québec' },
  { id: 'gatineau', nom: 'Gatineau' },
];

const lieu: LieuCP = {
  rta: 'H2X',
  nom: 'Montréal',
  province: 'Quebec',
  latitude: 45.5088,
  longitude: -73.5878,
};

function declencheur() {
  return screen.getByRole('button', { name: /Choisir une ville/ });
}

describe('SelecteurVille — déclencheur', () => {
  it('affiche la ville active dans son aria-label', () => {
    render(SelecteurVille, { villes, lieuCP: null, selection: 'quebec', onchoisir: vi.fn() });

    expect(declencheur().getAttribute('aria-label')).toBe(
      'Choisir une ville — actuellement Québec'
    );
  });

  it('affiche le RTA quand la sélection est un lieu géocodé', () => {
    render(SelecteurVille, { villes, lieuCP: lieu, selection: 'cp', onchoisir: vi.fn() });

    expect(declencheur().getAttribute('aria-label')).toBe('Choisir une ville — actuellement H2X');
  });
});

describe('SelecteurVille — ouverture et sélection', () => {
  it('ouvre le menu au clic et liste les villes fournies', async () => {
    const user = userEvent.setup();
    render(SelecteurVille, { villes, lieuCP: null, selection: 'montreal', onchoisir: vi.fn() });

    await user.click(declencheur());

    expect(screen.getByRole('menuitem', { name: 'Montréal' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Québec' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Gatineau' })).toBeTruthy();
  });

  it('sélectionner une ville notifie le parent et referme le menu', async () => {
    const user = userEvent.setup();
    const onchoisir = vi.fn();
    render(SelecteurVille, { villes, lieuCP: null, selection: 'montreal', onchoisir });

    await user.click(declencheur());
    await user.click(screen.getByRole('menuitem', { name: 'Québec' }));

    expect(onchoisir).toHaveBeenCalledWith('quebec');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // Le fond blanc seul ne suffit pas à distinguer l'entrée active : `aria-current`
  // porte le même repère sans dépendre de la couleur.
  it('marque la ville active avec aria-current, les autres à "false"', async () => {
    const user = userEvent.setup();
    render(SelecteurVille, { villes, lieuCP: null, selection: 'quebec', onchoisir: vi.fn() });

    await user.click(declencheur());

    expect(screen.getByRole('menuitem', { name: 'Québec' }).getAttribute('aria-current')).toBe(
      'true'
    );
    expect(screen.getByRole('menuitem', { name: 'Montréal' }).getAttribute('aria-current')).toBe(
      'false'
    );
  });

  it('ajoute le lieu géocodé comme entrée sélectionnable', async () => {
    const user = userEvent.setup();
    const onchoisir = vi.fn();
    render(SelecteurVille, { villes, lieuCP: lieu, selection: 'cp', onchoisir });

    await user.click(declencheur());
    await user.click(screen.getByRole('menuitem', { name: 'H2X' }));

    expect(onchoisir).toHaveBeenCalledWith('cp');
  });

  it('n’ajoute aucune entrée pour le lieu géocodé quand il n’y en a pas', async () => {
    const user = userEvent.setup();
    render(SelecteurVille, { villes, lieuCP: null, selection: 'montreal', onchoisir: vi.fn() });

    await user.click(declencheur());

    expect(screen.queryAllByRole('menuitem')).toHaveLength(3);
  });
});

describe('SelecteurVille — fermeture', () => {
  it('se ferme au clic extérieur', async () => {
    const user = userEvent.setup();
    render(SelecteurVille, { villes, lieuCP: null, selection: 'montreal', onchoisir: vi.fn() });

    await user.click(declencheur());
    expect(screen.getByRole('menu')).toBeTruthy();

    await user.click(document.body);

    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('se ferme à Échap et rend le focus au déclencheur', async () => {
    const user = userEvent.setup();
    render(SelecteurVille, { villes, lieuCP: null, selection: 'montreal', onchoisir: vi.fn() });

    await user.click(declencheur());
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(declencheur());
  });

  it('un Échap sans menu ouvert ne fait rien de particulier', async () => {
    const user = userEvent.setup();
    render(SelecteurVille, { villes, lieuCP: null, selection: 'montreal', onchoisir: vi.fn() });

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('SelecteurVille — navigation clavier', () => {
  it('pose le focus sur l’entrée active à l’ouverture', async () => {
    const user = userEvent.setup();
    render(SelecteurVille, { villes, lieuCP: null, selection: 'quebec', onchoisir: vi.fn() });

    await user.click(declencheur());

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Québec' }))
    );
  });

  it('se parcourt aux flèches, avec un rebouclage en bout de liste', async () => {
    const user = userEvent.setup();
    render(SelecteurVille, { villes, lieuCP: null, selection: 'montreal', onchoisir: vi.fn() });

    await user.click(declencheur());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Montréal' }))
    );

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Québec' }));

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Gatineau' }));

    // Après la dernière entrée, la flèche bas revient à la première.
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Montréal' }));

    // Et la flèche haut depuis la première revient à la dernière.
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Gatineau' }));
  });

  it('Home et End sautent directement aux extrémités', async () => {
    const user = userEvent.setup();
    render(SelecteurVille, { villes, lieuCP: null, selection: 'montreal', onchoisir: vi.fn() });

    await user.click(declencheur());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Montréal' }))
    );

    await user.keyboard('{End}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Gatineau' }));

    await user.keyboard('{Home}');
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Montréal' }));
  });
});
