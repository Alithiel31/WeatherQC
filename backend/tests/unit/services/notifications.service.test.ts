import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// `web-push` parle réellement le protocole HTTP/chiffrement Web Push — rien à
// voir avec le `fetch` global que `tests/setup.ts` bloque déjà. On le mocke
// explicitement, `WebPushError` compris, pour simuler les réponses 404/410
// du navigateur sans dépendre d'un vrai `instanceof`.
vi.mock('web-push', () => {
  class WebPushError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'WebPushError';
      this.statusCode = statusCode;
    }
  }
  return {
    default: {
      setVapidDetails: vi.fn(),
      sendNotification: vi.fn(),
    },
    WebPushError,
  };
});

import webpush, { WebPushError } from 'web-push';
import { config } from '../../../src/config.js';
import { log } from '../../../src/lib/log.js';
import { envoyerNotification } from '../../../src/services/notifications.service.js';

const ABONNEMENT = { endpoint: 'https://push.exemple.com/1', p256dh: 'p256dh', auth: 'auth' };
const NOTIFICATION = { titre: 'Orage · Montréal', corps: 'Orage prévu vers 16 h.' };

const VAPID_TEST = {
  publicKey: 'clé-publique-test',
  privateKey: 'clé-privée-test',
  contact: 'mailto:test@exemple.com',
};

describe('notifications.service', () => {
  const vapidOriginal = config.vapid;

  beforeEach(() => {
    vi.mocked(webpush.sendNotification).mockReset();
    vi.mocked(webpush.setVapidDetails).mockReset();
  });

  afterEach(() => {
    config.vapid = vapidOriginal;
  });

  it('renvoie "echec" sans appeler web-push si les clés VAPID sont absentes', async () => {
    config.vapid = null;

    const resultat = await envoyerNotification(ABONNEMENT, NOTIFICATION);

    expect(resultat).toBe('echec');
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  describe('avec des clés VAPID configurées', () => {
    beforeEach(() => {
      config.vapid = VAPID_TEST;
    });

    it('envoie la notification et renvoie "envoyee"', async () => {
      vi.mocked(webpush.sendNotification).mockResolvedValue({} as never);

      const resultat = await envoyerNotification(ABONNEMENT, NOTIFICATION);

      expect(resultat).toBe('envoyee');
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        VAPID_TEST.contact,
        VAPID_TEST.publicKey,
        VAPID_TEST.privateKey
      );
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: ABONNEMENT.endpoint,
          keys: { p256dh: ABONNEMENT.p256dh, auth: ABONNEMENT.auth },
        },
        JSON.stringify(NOTIFICATION),
        { timeout: 10_000 }
      );
    });

    it.each([404, 410])(
      'renvoie "expiree" quand web-push échoue avec le statut %d',
      async (statusCode) => {
        vi.mocked(webpush.sendNotification).mockRejectedValue(
          new WebPushError('révoqué', statusCode)
        );

        const resultat = await envoyerNotification(ABONNEMENT, NOTIFICATION);

        expect(resultat).toBe('expiree');
      }
    );

    it('renvoie "echec" pour une autre erreur web-push (ex. 500)', async () => {
      vi.mocked(webpush.sendNotification).mockRejectedValue(
        new WebPushError('amont en panne', 500)
      );

      const resultat = await envoyerNotification(ABONNEMENT, NOTIFICATION);

      expect(resultat).toBe('echec');
    });

    it('renvoie "echec" pour une erreur qui ne vient pas de web-push', async () => {
      vi.mocked(webpush.sendNotification).mockRejectedValue(new Error('réseau coupé'));

      const resultat = await envoyerNotification(ABONNEMENT, NOTIFICATION);

      expect(resultat).toBe('echec');
    });

    describe('journalisation', () => {
      it("n'écrit que l'hôte, jamais l'endpoint complet, pour un abonnement expiré", async () => {
        const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
        vi.mocked(webpush.sendNotification).mockRejectedValue(new WebPushError('révoqué', 410));

        await envoyerNotification(ABONNEMENT, NOTIFICATION);

        expect(warn).toHaveBeenCalledWith(
          'Abonnement push expiré',
          expect.objectContaining({ hote: 'push.exemple.com', statut: 410 })
        );
        expect(JSON.stringify(warn.mock.calls)).not.toContain(ABONNEMENT.endpoint);
        warn.mockRestore();
      });

      it("n'écrit que l'hôte, jamais l'endpoint complet, pour un échec d'envoi", async () => {
        const error = vi.spyOn(log, 'error').mockImplementation(() => {});
        vi.mocked(webpush.sendNotification).mockRejectedValue(new Error('réseau coupé'));

        await envoyerNotification(ABONNEMENT, NOTIFICATION);

        expect(error).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ hote: 'push.exemple.com', message: 'réseau coupé' })
        );
        expect(JSON.stringify(error.mock.calls)).not.toContain(ABONNEMENT.endpoint);
        error.mockRestore();
      });
    });

    describe('plafond de durée', () => {
      afterEach(() => {
        vi.useRealTimers();
      });

      it('renvoie "echec" au bout de 15 s si web-push ne conclut jamais', async () => {
        vi.useFakeTimers();
        const error = vi.spyOn(log, 'error').mockImplementation(() => {});
        // Une promesse qui ne se résout jamais : socket actif, aucune réponse.
        vi.mocked(webpush.sendNotification).mockReturnValue(new Promise(() => {}) as never);

        const envoi = envoyerNotification(ABONNEMENT, NOTIFICATION);
        await vi.advanceTimersByTimeAsync(15_000);

        expect(await envoi).toBe('echec');
        expect(error).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ message: expect.stringContaining('Délai') })
        );
        error.mockRestore();
      });
    });
  });
});
