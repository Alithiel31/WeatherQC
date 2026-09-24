import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { config } from '../../../src/config.js';
import { abonnementsParVille } from '../../../src/services/abonnements.service.js';

const SOUSCRIPTION_VALIDE = {
  ville: 'montreal',
  subscription: {
    endpoint: 'https://push.exemple.com/abonne/1',
    keys: { p256dh: 'clé-p256dh', auth: 'clé-auth' },
  },
};

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
      await request(app)
        .post('/api/notifications/abonnement')
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
        .send(SOUSCRIPTION_VALIDE)
        .expect(201);

      expect(res.body).toEqual({ statut: 'abonne' });
      const abonnements = abonnementsParVille('montreal');
      expect(abonnements).toHaveLength(1);
      expect(abonnements[0].endpoint).toBe(SOUSCRIPTION_VALIDE.subscription.endpoint);
    });

    it('POST /api/notifications/abonnement accepte des seuils personnalisés et les persiste', async () => {
      const res = await request(app)
        .post('/api/notifications/abonnement')
        .send({ ...SOUSCRIPTION_VALIDE, seuils: { rafales: 40 } })
        .expect(201);

      expect(res.body).toEqual({ statut: 'abonne' });
      expect(abonnementsParVille('montreal')[0].seuils).toEqual({ rafales: 40 });
    });

    it('POST /api/notifications/abonnement refuse un seuil hors bornes', async () => {
      const res = await request(app)
        .post('/api/notifications/abonnement')
        .send({ ...SOUSCRIPTION_VALIDE, seuils: { precipitationProbabilite: 150 } })
        .expect(400);

      expect(res.body.status).toBe(400);
    });

    it('POST /api/notifications/abonnement refuse une ville inconnue', async () => {
      const res = await request(app)
        .post('/api/notifications/abonnement')
        .send({ ...SOUSCRIPTION_VALIDE, ville: 'nulle-part' })
        .expect(404);

      expect(res.body.error).toContain('Ville inconnue');
    });

    it('POST /api/notifications/abonnement refuse un corps incomplet', async () => {
      const res = await request(app)
        .post('/api/notifications/abonnement')
        .send({ ville: 'montreal', subscription: { endpoint: 'https://push.exemple.com/x' } })
        .expect(400);

      expect(res.body.status).toBe(400);
      expect(res.body.details).toBeInstanceOf(Array);
    });

    it('POST /api/notifications/abonnement refuse un endpoint non-URL', async () => {
      await request(app)
        .post('/api/notifications/abonnement')
        .send({
          ...SOUSCRIPTION_VALIDE,
          subscription: { ...SOUSCRIPTION_VALIDE.subscription, endpoint: 'pas-une-url' },
        })
        .expect(400);
    });

    it('un second abonnement avec le même endpoint remplace le premier (pas de doublon)', async () => {
      await request(app)
        .post('/api/notifications/abonnement')
        .send(SOUSCRIPTION_VALIDE)
        .expect(201);
      await request(app)
        .post('/api/notifications/abonnement')
        .send({ ...SOUSCRIPTION_VALIDE, ville: 'quebec' })
        .expect(201);

      expect(abonnementsParVille('montreal')).toEqual([]);
      expect(abonnementsParVille('quebec')).toHaveLength(1);
    });

    it('DELETE /api/notifications/abonnement retire un abonnement existant', async () => {
      await request(app)
        .post('/api/notifications/abonnement')
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
