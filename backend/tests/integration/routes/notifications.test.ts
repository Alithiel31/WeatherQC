import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { config } from '../../../src/config.js';
import { abonnementsParVille } from '../../../src/services/abonnements.service.js';

const SOUSCRIPTION_VALIDE = {
  ville: 'montreal',
  subscription: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abonne-1',
    // Tailles réelles : 65 octets (87 caractères base64url) et 16 octets (22).
    keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
  },
};

const VAPID_TEST = {
  publicKey: 'clé-publique-test',
  privateKey: 'clé-privée-test',
  contact: 'mailto:test@exemple.com',
};

// Ce fichier envoie plus de POST que le quota horaire de création d'abonnement
// (par IP) : chaque appel porte donc un client distinct, pour que ces tests ne
// dépendent pas du limiteur. Celui-ci est testé à part, dans
// `durcissement.test.ts`. Chaîne telle que la reçoit Express en production :
// « client, proxy ».
let numeroClient = 0;
const clientUnique = () => `203.0.113.${++numeroClient}, 10.1.2.3`;

describe('Notifications push', () => {
  // `config` est un singleton partagé par tout le fichier de test : on note
  // sa valeur de départ (absente en environnement de test par défaut) pour la
  // restaurer après chaque test plutôt que de la mocker par-dessus.
  const vapidOriginal = config.vapid;

  afterEach(() => {
    config.vapid = vapidOriginal;
  });

  describe('sans clés VAPID configurées', () => {
    beforeEach(() => {
      config.vapid = null;
    });

    it('GET /api/notifications/cle-publique répond 503', async () => {
      const res = await request(app).get('/api/notifications/cle-publique').expect(503);
      expect(res.body.status).toBe(503);
    });

    it('POST /api/notifications/abonnement répond 503', async () => {
      await request(app)
        .post('/api/notifications/abonnement')
        .set('X-Forwarded-For', clientUnique())
        .send(SOUSCRIPTION_VALIDE)
        .expect(503);
    });
  });

  describe('avec des clés VAPID configurées', () => {
    beforeEach(() => {
      config.vapid = VAPID_TEST;
    });

    it('GET /api/notifications/cle-publique renvoie la clé publique', async () => {
      const res = await request(app).get('/api/notifications/cle-publique').expect(200);
      expect(res.body).toEqual({ clePublique: 'clé-publique-test' });
    });

    it('POST /api/notifications/abonnement enregistre un abonnement valide', async () => {
      const res = await request(app)
        .post('/api/notifications/abonnement')
        .set('X-Forwarded-For', clientUnique())
        .send(SOUSCRIPTION_VALIDE)
        .expect(201);

      expect(res.body).toEqual({ statut: 'abonne' });
      const abonnements = abonnementsParVille('montreal');
      expect(abonnements).toHaveLength(1);
      expect(abonnements[0].endpoint).toBe(SOUSCRIPTION_VALIDE.subscription.endpoint);
    });

    it('POST /api/notifications/abonnement refuse une ville inconnue', async () => {
      const res = await request(app)
        .post('/api/notifications/abonnement')
        .set('X-Forwarded-For', clientUnique())
        .send({ ...SOUSCRIPTION_VALIDE, ville: 'nulle-part' })
        .expect(404);

      expect(res.body.error).toContain('Ville inconnue');
    });

    it('POST /api/notifications/abonnement refuse un corps incomplet', async () => {
      const res = await request(app)
        .post('/api/notifications/abonnement')
        .set('X-Forwarded-For', clientUnique())
        .send({ ville: 'montreal', subscription: { endpoint: 'https://push.exemple.com/x' } })
        .expect(400);

      expect(res.body.status).toBe(400);
      expect(res.body.details).toBeInstanceOf(Array);
    });

    it('POST /api/notifications/abonnement refuse un endpoint non-URL', async () => {
      await request(app)
        .post('/api/notifications/abonnement')
        .set('X-Forwarded-For', clientUnique())
        .send({
          ...SOUSCRIPTION_VALIDE,
          subscription: { ...SOUSCRIPTION_VALIDE.subscription, endpoint: 'pas-une-url' },
        })
        .expect(400);
    });

    describe('validation stricte de la souscription', () => {
      const avecEndpoint = (endpoint: string) => ({
        ...SOUSCRIPTION_VALIDE,
        subscription: { ...SOUSCRIPTION_VALIDE.subscription, endpoint },
      });
      const avecCles = (keys: { p256dh: string; auth: string }) => ({
        ...SOUSCRIPTION_VALIDE,
        subscription: { ...SOUSCRIPTION_VALIDE.subscription, keys },
      });

      it.each([
        ['http en clair', 'http://fcm.googleapis.com/fcm/send/x'],
        ['hôte inconnu', 'https://push.exemple.com/x'],
        ['port explicite', 'https://fcm.googleapis.com:8443/x'],
        ['faux suffixe Windows', 'https://evilnotify.windows.com/x'],
        ['faux suffixe Apple', 'https://evilpush.apple.com/x'],
        ["suffixe en sous-domaine d'un autre domaine", 'https://push.apple.com.evil.net/x'],
        ["identifiants dans l'URL", 'https://fcm.googleapis.com@evil.net/x'],
        ['IP littérale', 'https://127.0.0.1/x'],
        ['endpoint trop long', `https://fcm.googleapis.com/${'a'.repeat(2048)}`],
      ])('refuse un endpoint : %s', async (_cas, endpoint) => {
        await request(app)
          .post('/api/notifications/abonnement')
          .set('X-Forwarded-For', clientUnique())
          .send(avecEndpoint(endpoint))
          .expect(400);
        expect(abonnementsParVille('montreal')).toEqual([]);
      });

      it.each([
        ['Windows (Edge)', 'https://db5p.notify.windows.com/w/?token=x'],
        ['Apple (Safari)', 'https://web.push.apple.com/x'],
        ['Mozilla (Firefox)', 'https://updates.push.services.mozilla.com/wpush/v2/x'],
      ])('accepte un endpoint %s', async (_cas, endpoint) => {
        await request(app)
          .post('/api/notifications/abonnement')
          .set('X-Forwarded-For', clientUnique())
          .send(avecEndpoint(endpoint))
          .expect(201);
      });

      it.each([
        ['p256dh trop court', { p256dh: 'B'.repeat(86), auth: 'A'.repeat(22) }],
        ['p256dh hors base64url', { p256dh: `${'B'.repeat(86)}+`, auth: 'A'.repeat(22) }],
        ['auth trop long', { p256dh: 'B'.repeat(87), auth: 'A'.repeat(23) }],
        ['auth vide', { p256dh: 'B'.repeat(87), auth: '' }],
      ])('refuse des clés invalides : %s', async (_cas, keys) => {
        await request(app)
          .post('/api/notifications/abonnement')
          .set('X-Forwarded-For', clientUnique())
          .send(avecCles(keys))
          .expect(400);
        expect(abonnementsParVille('montreal')).toEqual([]);
      });
    });

    it('un second abonnement avec le même endpoint remplace le premier (pas de doublon)', async () => {
      await request(app)
        .post('/api/notifications/abonnement')
        .set('X-Forwarded-For', clientUnique())
        .send(SOUSCRIPTION_VALIDE)
        .expect(201);
      await request(app)
        .post('/api/notifications/abonnement')
        .set('X-Forwarded-For', clientUnique())
        .send({ ...SOUSCRIPTION_VALIDE, ville: 'quebec' })
        .expect(201);

      expect(abonnementsParVille('montreal')).toEqual([]);
      expect(abonnementsParVille('quebec')).toHaveLength(1);
    });

    it('DELETE /api/notifications/abonnement retire un abonnement existant', async () => {
      await request(app)
        .post('/api/notifications/abonnement')
        .set('X-Forwarded-For', clientUnique())
        .send(SOUSCRIPTION_VALIDE)
        .expect(201);

      await request(app)
        .delete('/api/notifications/abonnement')
        .send({ endpoint: SOUSCRIPTION_VALIDE.subscription.endpoint })
        .expect(204);

      expect(abonnementsParVille('montreal')).toEqual([]);
    });

    // Idempotent à dessein — voir le commentaire du contrôleur.
    it('DELETE /api/notifications/abonnement répond 204 même pour un endpoint inconnu', async () => {
      await request(app)
        .delete('/api/notifications/abonnement')
        .send({ endpoint: 'https://push.exemple.com/jamais-vu' })
        .expect(204);
    });

    it('DELETE /api/notifications/abonnement refuse un corps invalide', async () => {
      await request(app).delete('/api/notifications/abonnement').send({}).expect(400);
    });
  });
});
