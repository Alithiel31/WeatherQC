import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  supportePush,
  villeAbonnee,
  abonner,
  desabonner,
  PermissionRefuseeError,
} from '../../src/lib/notifications.ts';
import { ErreurApi } from '../../src/lib/api.ts';

function definirServiceWorker(registration: unknown): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { ready: Promise.resolve(registration) },
    configurable: true,
  });
}

function retirerServiceWorker(): void {
  delete (navigator as { serviceWorker?: unknown }).serviceWorker;
}

function creerAbonnementFactice(endpoint = 'https://push.example/abc') {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'clef-p256dh', auth: 'clef-auth' } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

/** Distingue plusieurs routes, contrairement à `stubFetchJson()` — `abonner()` en appelle deux. */
function stubFetchParUrl(reponses: Record<string, { status: number; corps: unknown }>) {
  const mock = vi.fn(async (url: string) => {
    const reponse = reponses[url];
    if (!reponse) throw new Error(`Appel non prévu vers ${url}`);
    return {
      ok: reponse.status >= 200 && reponse.status < 300,
      status: reponse.status,
      json: async () => reponse.corps,
    };
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

beforeEach(() => {
  localStorage.clear();
  retirerServiceWorker();
});

afterEach(() => {
  retirerServiceWorker();
});

describe('supportePush', () => {
  it('vrai quand serviceWorker, PushManager et Notification sont tous supportés', () => {
    definirServiceWorker({});
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { requestPermission: vi.fn() });

    expect(supportePush()).toBe(true);
  });

  it('faux sans serviceWorker', () => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { requestPermission: vi.fn() });

    expect(supportePush()).toBe(false);
  });

  it('faux sans PushManager', () => {
    definirServiceWorker({});
    vi.stubGlobal('Notification', { requestPermission: vi.fn() });

    expect(supportePush()).toBe(false);
  });

  it('faux sans Notification', () => {
    definirServiceWorker({});
    vi.stubGlobal('PushManager', class {});

    expect(supportePush()).toBe(false);
  });
});

describe('villeAbonnee', () => {
  it('retourne null sans ville mémorisée, sans toucher au service worker', async () => {
    await expect(villeAbonnee()).resolves.toBeNull();
  });

  it('retourne la ville mémorisée quand un abonnement existe encore', async () => {
    localStorage.setItem('villeAbonnee', 'montreal');
    definirServiceWorker({
      pushManager: { getSubscription: vi.fn().mockResolvedValue(creerAbonnementFactice()) },
    });

    await expect(villeAbonnee()).resolves.toBe('montreal');
  });

  it('efface la mémorisation et retourne null si l’abonnement navigateur a disparu', async () => {
    localStorage.setItem('villeAbonnee', 'montreal');
    definirServiceWorker({
      pushManager: { getSubscription: vi.fn().mockResolvedValue(null) },
    });

    await expect(villeAbonnee()).resolves.toBeNull();
    expect(localStorage.getItem('villeAbonnee')).toBeNull();
  });
});

describe('abonner', () => {
  it('lève PermissionRefuseeError sans s’abonner si la permission est refusée', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('denied') });
    const subscribe = vi.fn();
    definirServiceWorker({ pushManager: { subscribe } });

    await expect(abonner('montreal')).rejects.toThrow(PermissionRefuseeError);
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('relaie l’erreur si la clé publique est indisponible', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });
    definirServiceWorker({ pushManager: { subscribe: vi.fn() } });
    stubFetchParUrl({
      '/api/notifications/cle-publique': {
        status: 503,
        corps: {
          status: 503,
          error: 'Notifications indisponibles — clés VAPID non configurées côté serveur.',
        },
      },
    });

    await expect(abonner('montreal')).rejects.toThrow('clés VAPID');
  });

  it('désabonne le navigateur si le backend refuse l’abonnement', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });
    const abonnement = creerAbonnementFactice();
    definirServiceWorker({ pushManager: { subscribe: vi.fn().mockResolvedValue(abonnement) } });
    stubFetchParUrl({
      '/api/notifications/cle-publique': { status: 200, corps: { clePublique: 'clef-vapid' } },
      '/api/notifications/abonnement': {
        status: 400,
        corps: { status: 400, error: 'Ville inconnue.' },
      },
    });

    await expect(abonner('inconnue')).rejects.toThrow('Ville inconnue');
    expect(abonnement.unsubscribe).toHaveBeenCalledOnce();
    expect(localStorage.getItem('villeAbonnee')).toBeNull();
  });

  it('mémorise la ville une fois l’abonnement accepté par le backend', async () => {
    vi.stubGlobal('Notification', { requestPermission: vi.fn().mockResolvedValue('granted') });
    const abonnement = creerAbonnementFactice();
    const subscribe = vi.fn().mockResolvedValue(abonnement);
    definirServiceWorker({ pushManager: { subscribe } });
    const fetchMock = stubFetchParUrl({
      '/api/notifications/cle-publique': { status: 200, corps: { clePublique: 'clef-vapid' } },
      '/api/notifications/abonnement': { status: 201, corps: { statut: 'abonne' } },
    });

    await abonner('montreal');

    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({
        userVisibleOnly: true,
        applicationServerKey: expect.any(Uint8Array),
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/abonnement',
      expect.objectContaining({ method: 'POST' })
    );
    expect(localStorage.getItem('villeAbonnee')).toBe('montreal');
    expect(abonnement.unsubscribe).not.toHaveBeenCalled();
  });
});

describe('desabonner', () => {
  it('efface la mémorisation sans appel réseau si aucun abonnement n’est actif', async () => {
    localStorage.setItem('villeAbonnee', 'montreal');
    definirServiceWorker({ pushManager: { getSubscription: vi.fn().mockResolvedValue(null) } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await desabonner();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('villeAbonnee')).toBeNull();
  });

  it('désabonne le navigateur une fois le backend prévenu', async () => {
    localStorage.setItem('villeAbonnee', 'montreal');
    const abonnement = creerAbonnementFactice('https://push.example/xyz');
    definirServiceWorker({
      pushManager: { getSubscription: vi.fn().mockResolvedValue(abonnement) },
    });
    const fetchMock = stubFetchParUrl({
      '/api/notifications/abonnement': { status: 204, corps: undefined },
    });

    await desabonner();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/notifications/abonnement',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ endpoint: 'https://push.example/xyz' }),
      })
    );
    expect(abonnement.unsubscribe).toHaveBeenCalledOnce();
    expect(localStorage.getItem('villeAbonnee')).toBeNull();
  });

  it('laisse l’abonnement actif si le backend refuse la désinscription', async () => {
    localStorage.setItem('villeAbonnee', 'montreal');
    const abonnement = creerAbonnementFactice();
    definirServiceWorker({
      pushManager: { getSubscription: vi.fn().mockResolvedValue(abonnement) },
    });
    stubFetchParUrl({
      '/api/notifications/abonnement': { status: 500, corps: {} },
    });

    await expect(desabonner()).rejects.toThrow(ErreurApi);
    expect(abonnement.unsubscribe).not.toHaveBeenCalled();
    expect(localStorage.getItem('villeAbonnee')).toBe('montreal');
  });
});
