import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';

const { supportePush, villeAbonnee, abonner, desabonner, PermissionRefuseeError } = vi.hoisted(
  () => ({
    supportePush: vi.fn(),
    villeAbonnee: vi.fn(),
    abonner: vi.fn(),
    desabonner: vi.fn(),
    PermissionRefuseeError: class PermissionRefuseeError extends Error {},
  })
);

// Le module traverse `navigator.serviceWorker` / `PushManager`, déjà couverts
// par ses propres tests unitaires (voir `tests/unit/notifications.test.ts`) :
// ici on ne teste que la façon dont le composant réagit à ce qu'il renvoie.
vi.mock('../../src/lib/notifications.ts', () => ({
  supportePush,
  villeAbonnee,
  abonner,
  desabonner,
  PermissionRefuseeError,
}));

const { ErreurApi } = vi.hoisted(() => ({ ErreurApi: class ErreurApi extends Error {} }));
vi.mock('../../src/lib/api.ts', () => ({ ErreurApi }));

const { default: AlertesMeteo } = await import('../../src/lib/AlertesMeteo.svelte');
type Preferences = import('../../src/lib/preferences.svelte.ts').Preferences;
type SeuilsAlerte = import('../../src/lib/types.ts').SeuilsAlerte;

/**
 * Seuls `seuilsAlerte`/`memoriserSeuils` sont utilisés par le composant — le
 * reste de `Preferences` (ville, code postal, unité...) lui est étranger.
 */
function preferencesFactices(seuilsAlerte: SeuilsAlerte | null = null) {
  return { seuilsAlerte, memoriserSeuils: vi.fn() } as unknown as Preferences;
}

const props = { villeId: 'montreal', villeNom: 'Montréal', preferences: preferencesFactices() };
const nomActiver = 'Activer les alertes météo pour Montréal';

beforeEach(() => {
  vi.clearAllMocks();
  villeAbonnee.mockResolvedValue(null);
});

describe('support absent', () => {
  it('ne rend rien quand supportePush() est faux', async () => {
    supportePush.mockReturnValue(false);
    const { container } = render(AlertesMeteo, props);

    expect(container.textContent?.trim()).toBe('');
    expect(villeAbonnee).not.toHaveBeenCalled();
  });
});

describe('support présent', () => {
  beforeEach(() => {
    supportePush.mockReturnValue(true);
  });

  it('affiche le bouton d’activation par défaut', async () => {
    render(AlertesMeteo, props);

    expect(await screen.findByRole('button', { name: nomActiver })).toBeTruthy();
  });

  it('affiche l’état activé quand l’abonnement mémorisé correspond à la ville active', async () => {
    villeAbonnee.mockResolvedValue('montreal');
    render(AlertesMeteo, props);

    expect(await screen.findByText('Alertes météo activées pour Montréal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Désactiver' })).toBeTruthy();
  });

  it('affiche le bouton d’activation si l’abonnement mémorisé concerne une autre ville', async () => {
    villeAbonnee.mockResolvedValue('quebec');
    render(AlertesMeteo, props);

    expect(await screen.findByRole('button', { name: nomActiver })).toBeTruthy();
  });

  it('ignore silencieusement un échec de villeAbonnee() au montage', async () => {
    villeAbonnee.mockRejectedValue(new Error('stockage indisponible'));
    render(AlertesMeteo, props);

    expect(await screen.findByRole('button', { name: nomActiver })).toBeTruthy();
  });

  it('active l’abonnement au clic et passe à l’état activé', async () => {
    const user = userEvent.setup();
    let resoudre!: () => void;
    abonner.mockReturnValue(
      new Promise<void>((r) => {
        resoudre = r;
      })
    );
    render(AlertesMeteo, props);

    await user.click(await screen.findByRole('button', { name: nomActiver }));

    expect(await screen.findByRole('button', { name: 'Activation…' })).toBeTruthy();
    resoudre();

    await waitFor(() => expect(screen.getByRole('button', { name: 'Désactiver' })).toBeTruthy());
    expect(abonner).toHaveBeenCalledWith('montreal');
  });

  it('la section « Personnaliser les seuils » est repliée par défaut', async () => {
    const { container } = render(AlertesMeteo, props);
    await screen.findByRole('button', { name: nomActiver });

    expect(container.querySelector('details')?.open).toBe(false);
  });

  it('sans personnalisation, active sans seuils (signature identique à avant)', async () => {
    const user = userEvent.setup();
    abonner.mockResolvedValue(undefined);
    render(AlertesMeteo, props);

    await user.click(await screen.findByRole('button', { name: nomActiver }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Désactiver' })).toBeTruthy());
    expect(abonner).toHaveBeenCalledWith('montreal');
    expect(abonner).not.toHaveBeenCalledWith('montreal', expect.anything());
  });

  it('ouvrir la personnalisation et ajuster les curseurs passe les seuils choisis à abonner', async () => {
    const user = userEvent.setup();
    const preferences = preferencesFactices();
    abonner.mockResolvedValue(undefined);
    const { container } = render(AlertesMeteo, { ...props, preferences });

    await user.click(await screen.findByText('Personnaliser les seuils'));
    const [precip, chute, rafales] = container.querySelectorAll('input[type="range"]');
    await fireEvent.input(precip, { target: { value: '50' } });
    await fireEvent.input(chute, { target: { value: '5' } });
    await fireEvent.input(rafales, { target: { value: '40' } });

    await user.click(screen.getByRole('button', { name: nomActiver }));

    const seuils = { precipitationProbabilite: 50, chuteTemperature: 5, rafales: 40 };
    await waitFor(() => expect(abonner).toHaveBeenCalledWith('montreal', seuils));
    expect(preferences.memoriserSeuils).toHaveBeenCalledWith(seuils);
  });

  it('affiche le message d’une PermissionRefuseeError plutôt que le message générique', async () => {
    const user = userEvent.setup();
    abonner.mockRejectedValue(new PermissionRefuseeError('Permission de notification refusée.'));
    render(AlertesMeteo, props);

    await user.click(await screen.findByRole('button', { name: nomActiver }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Permission de notification refusée.'
    );
  });

  it('affiche le message porté par une ErreurApi', async () => {
    const user = userEvent.setup();
    abonner.mockRejectedValue(
      new ErreurApi('Notifications indisponibles — clés VAPID non configurées côté serveur.')
    );
    render(AlertesMeteo, props);

    await user.click(await screen.findByRole('button', { name: nomActiver }));

    expect((await screen.findByRole('alert')).textContent).toContain('clés VAPID');
  });

  it('retombe sur un message générique pour une erreur inattendue', async () => {
    const user = userEvent.setup();
    abonner.mockRejectedValue(new TypeError('Failed to fetch'));
    render(AlertesMeteo, props);

    await user.click(await screen.findByRole('button', { name: nomActiver }));

    expect((await screen.findByRole('alert')).textContent).toContain('Vérifiez la connexion');
  });

  it('désactive l’abonnement au clic et revient à l’état inactif', async () => {
    const user = userEvent.setup();
    villeAbonnee.mockResolvedValue('montreal');
    desabonner.mockResolvedValue(undefined);
    render(AlertesMeteo, props);

    await user.click(await screen.findByRole('button', { name: 'Désactiver' }));

    await waitFor(() => expect(screen.getByRole('button', { name: nomActiver })).toBeTruthy());
    expect(desabonner).toHaveBeenCalledOnce();
  });

  it('affiche une erreur et reste activé si la désactivation échoue', async () => {
    const user = userEvent.setup();
    villeAbonnee.mockResolvedValue('montreal');
    desabonner.mockRejectedValue(new ErreurApi('Désabonnement refusé par le serveur.'));
    render(AlertesMeteo, props);

    await user.click(await screen.findByRole('button', { name: 'Désactiver' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Désabonnement refusé par le serveur.'
    );
    expect(screen.getByRole('button', { name: 'Désactiver' })).toBeTruthy();
  });
});
