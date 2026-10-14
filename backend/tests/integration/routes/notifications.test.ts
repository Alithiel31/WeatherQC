import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { config } from '../../../src/config.js';
import {
  abonnementsParVille,
  nombreAbonnements,
} from '../../../src/services/abonnements.service.js';

const SOUSCRIPTION_VALIDE = {
  ville: 'montreal',
  subscription: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abonne-1',
    keys: { p256dh: 'clé-p256dh', auth: 'clé-auth' },
  },
};

/**
 * Le limiteur des abonnements (5/min/IP) garde son compteur pour tout le
 * fichier : chaque requête porte donc un client distinct, sauf le test qui
 * éprouve justement le quota. Même chaîne qu'en production — « client, proxy ».
 */
let compteurClients = 0;
const nouveauClient = () => `203.0.113.${++compteurClients % 250}, 10.1.2.3`;

function poster(corps: object) {
  return request(app)
    .post('/api/notifications/abonnement')
    .set('X-Forwarded-For', nouveauClient())
    .send(corps);
}

const avecEndpoint = (endpoint: string) => ({
  ...SOUSCRIPTION_VALIDE,
  subscription: { ...SOUSCRIPTION_VALIDE.subscription, endpoint },
});

const VAPID_TEST = {
  publicKey: 'clé-publique-test',
  privateKey: 'clé-privée-test',
  contact: 'mailto:test@exemple.com',
};

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
      await poster(SOUSCRIPTION_VALIDE).expect(503);
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
      const res = await poster(SOUSCRIPTION_VALIDE).expect(201);

      expect(res.body).toEqual({ statut: 'abonne' });
      const abonnements = abonnementsParVille('montreal');
      expect(abonnements).toHaveLength(1);
      expect(abonnements[0].endpoint).toBe(SOUSCRIPTION_VALIDE.subscription.endpoint);
    });

    it('POST /api/notifications/abonnement refuse une ville inconnue', async () => {
      const res = await poster({ ...SOUSCRIPTION_VALIDE, ville: 'nulle-part' }).expect(404);

      expect(res.body.error).toContain('Ville inconnue');
    });

    it('POST /api/notifications/abonnement refuse un corps incomplet', async () => {
      const res = await poster({
        ville: 'montreal',
        subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/x' },
      }).expect(400);

      expect(res.body.status).toBe(400);
      expect(res.body.details).toBeInstanceOf(Array);
    });

    it('POST /api/notifications/abonnement refuse un endpoint non-URL', async () => {
      await poster(avecEndpoint('pas-une-url')).expect(400);
    });

    // SSRF : le vérificateur horaire POSTe vers chaque endpoint enregistré.
    it.each([
      ['une IP du réseau local', 'http://192.168.1.10/push'],
      ['un service interne du compose', 'https://backend:3005/api/sante'],
      ['du HTTP en clair vers un service push', 'http://fcm.googleapis.com/fcm/send/x'],
      ['un port non standard', 'https://fcm.googleapis.com:8443/fcm/send/x'],
      ['des identifiants dans l’URL', 'https://u:p@fcm.googleapis.com/fcm/send/x'],
      ['un hôte qui imite un suffixe autorisé', 'https://evil-push.apple.com.attaquant.net/x'],
      ['un hôte arbitraire', 'https://push.exemple.com/abonne/1'],
    ])('POST /api/notifications/abonnement refuse %s', async (_cas, endpoint) => {
      const res = await poster(avecEndpoint(endpoint)).expect(400);
      expect(JSON.stringify(res.body.details)).toContain('service push reconnu');
      expect(nombreAbonnements()).toBe(0);
    });

    it.each([
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/abc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ])('POST /api/notifications/abonnement accepte %s', async (endpoint) => {
      await poster(avecEndpoint(endpoint)).expect(201);
    });

    it('POST /api/notifications/abonnement refuse des clés démesurées', async () => {
      await poster({
        ...SOUSCRIPTION_VALIDE,
        subscription: {
          ...SOUSCRIPTION_VALIDE.subscription,
          keys: { p256dh: 'x'.repeat(5000), auth: 'clé-auth' },
        },
      }).expect(400);
    });

    it('POST /api/notifications/abonnement applique son propre quota par client', async () => {
      const client = '198.51.100.77, 10.1.2.3';
      for (let i = 0; i < config.rateLimit.maxAbonnement; i++) {
        await request(app)
          .post('/api/notifications/abonnement')
          .set('X-Forwarded-For', client)
          .send(avecEndpoint(`https://fcm.googleapis.com/fcm/send/quota-${i}`))
          .expect(201);
      }

      const bloque = await request(app)
        .post('/api/notifications/abonnement')
        .set('X-Forwarded-For', client)
        .send(avecEndpoint('https://fcm.googleapis.com/fcm/send/quota-x'))
        .expect(429);
      expect(bloque.body.error).toContain('Trop de requêtes');

      // Le désabonnement n'écrit rien : il ne doit jamais être bloqué par ce quota.
      await request(app)
        .delete('/api/notifications/abonnement')
        .set('X-Forwarded-For', client)
        .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/quota-0' })
        .expect(204);
    });

    describe('plafond global des abonnements', () => {
      const plafondOriginal = config.abonnementsMax;
      afterEach(() => {
        config.abonnementsMax = plafondOriginal;
      });

      it('refuse un nouvel abonnement au-delà du plafond, mais pas un réabonnement', async () => {
        config.abonnementsMax = 1;
        await poster(SOUSCRIPTION_VALIDE).expect(201);

        const res = await poster(avecEndpoint('https://fcm.googleapis.com/fcm/send/autre')).expect(
          503
        );
        expect(res.body.error).toContain('nombre maximal');

        // Même endpoint, autre ville : remplace l'existant, ne grossit pas la table.
        await poster({ ...SOUSCRIPTION_VALIDE, ville: 'quebec' }).expect(201);
        expect(nombreAbonnements()).toBe(1);
      });
    });

    it('un second abonnement avec le même endpoint remplace le premier (pas de doublon)', async () => {
      await poster(SOUSCRIPTION_VALIDE).expect(201);
      await poster({ ...SOUSCRIPTION_VALIDE, ville: 'quebec' }).expect(201);

      expect(abonnementsParVille('montreal')).toEqual([]);
      expect(abonnementsParVille('quebec')).toHaveLength(1);
    });

    it('DELETE /api/notifications/abonnement retire un abonnement existant', async () => {
      await poster(SOUSCRIPTION_VALIDE).expect(201);

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
        .send({ endpoint: 'https://fcm.googleapis.com/fcm/send/jamais-vu' })
        .expect(204);
    });

    it('DELETE /api/notifications/abonnement refuse un corps invalide', async () => {
      await request(app).delete('/api/notifications/abonnement').send({}).expect(400);
    });
  });
});
