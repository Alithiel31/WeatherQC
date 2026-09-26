import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../../src/index.js';
import { reponseOpenMeteo } from '../../fixtures/openmeteo.js';
import { stubFetchJson, stubFetchTimeout } from '../../helpers/fetch.js';

describe('Routes Prévisions', () => {
  describe('GET /api/previsions/:ville', () => {
    it('doit retourner les prévisions pour montreal', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app).get('/api/previsions/montreal').expect(200);

      expect(response.body).toHaveProperty('ville');
      expect(response.body).toHaveProperty('depuisCache');
      expect(response.body.ville.nom).toBe('Montréal');
    });

    it('doit mapper les données renvoyées par Open-Meteo', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app).get('/api/previsions/quebec').expect(200);

      expect(response.body.actuel.temperature).toBe(-5.2);
      expect(response.body.actuel.jour).toBe(true);
      expect(response.body.horaire).toHaveLength(48);
      expect(response.body.horaire[0].heure).toBe('2026-01-15T14:00');
      expect(response.body.quotidien).toHaveLength(7);
    });

    // Le fixture par défaut ne franchit aucun seuil de `detecteur-alertes.ts` :
    // il neige déjà (le code actuel est déjà une précipitation), aucune chute de
    // température, vent ou code verglas/orage dans les 6 prochaines heures.
    it('ne renvoie aucune alerte quand rien ne franchit les seuils', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app).get('/api/previsions/montreal').expect(200);

      expect(response.body.alertes).toEqual([]);
    });

    // Régression : la détection d'alertes (`detecteur-alertes.ts`) n'était
    // utilisée que par le cron de notifications push — jamais exposée pour un
    // affichage à l'écran. Un code WMO de verglas dans les prochaines heures
    // doit désormais ressortir dans la réponse elle-même.
    it('expose une alerte réelle quand un code WMO de verglas approche', async () => {
      const fixtureAvecVerglas = structuredClone(reponseOpenMeteo);
      fixtureAvecVerglas.hourly.weather_code[14] = 56; // première heure à venir
      stubFetchJson(fixtureAvecVerglas);

      const response = await request(app).get('/api/previsions/montreal').expect(200);

      expect(response.body.alertes).toHaveLength(1);
      expect(response.body.alertes[0]).toMatchObject({
        type: 'verglas',
        importante: true,
      });
      expect(response.body.alertes[0].titre).toContain('verglas');
      expect(response.body.alertes[0].titre).toContain('Montréal');
    });

    it('doit servir la deuxième requête depuis le cache', async () => {
      const fetchMock = stubFetchJson(reponseOpenMeteo);

      const premiere = await request(app).get('/api/previsions/montreal').expect(200);
      const seconde = await request(app).get('/api/previsions/montreal').expect(200);

      expect(premiere.body.depuisCache).toBe(false);
      expect(seconde.body.depuisCache).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // Régression : ces clés sont héritées d'Object.prototype et renvoyaient une
    // valeur truthy, si bien que la garde « ville inconnue » les laissait passer
    // et qu'un appel partait chez Open-Meteo avec des coordonnées `undefined`.
    // `toString` et `valueOf` ne sont pas listées : le `.toLowerCase()` du schéma
    // les transforme en clés qui n'existent sur aucun prototype.
    it.each(['constructor', '__proto__'])(
      'doit retourner 404 sans appeler l’amont pour la clé héritée %s',
      async (cle) => {
        // Aucun stub : le filet de `tests/setup.ts` fait échouer tout appel réseau,
        // donc un 404 ici prouve qu'aucun appel amont n'a été tenté.
        const response = await request(app).get(`/api/previsions/${cle}`).expect(404);

        expect(response.body.error).toContain('Ville inconnue');
      }
    );

    it('doit retourner erreur 404 pour une ville inconnue', async () => {
      const response = await request(app).get('/api/previsions/xyzabc').expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('inconnue');
    });

    it('doit retourner erreur 502 si Open-Meteo répond en erreur', async () => {
      stubFetchJson({}, 503);

      const response = await request(app).get('/api/previsions/montreal').expect(502);

      expect(response.body.error).toContain('503');
    });

    // Régression : un 200 au contenu inattendu jetait un TypeError pendant le
    // mapping et ressortait en 500, comme si le bug était de notre côté.
    it('doit retourner 502 si Open-Meteo répond 200 avec un corps inexploitable', async () => {
      stubFetchJson({ current: { time: '2026-01-15T14:00' } });

      const response = await request(app).get('/api/previsions/montreal').expect(502);

      expect(response.body.error).toContain('inexploitable');
    });

    it('doit retourner erreur 504 si Open-Meteo ne répond pas à temps', async () => {
      stubFetchTimeout();

      const response = await request(app).get('/api/previsions/montreal').expect(504);

      expect(response.body.error).toContain('Open-Meteo');
    });
  });

  describe('GET /api/previsions-coordonnees', () => {
    it('doit retourner les prévisions pour des coordonnées valides', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-73.6')
        .expect(200);

      expect(response.body).toHaveProperty('ville');
      expect(response.body.ville.latitude).toBe(45.5);
      expect(response.body.ville.longitude).toBe(-73.6);
    });

    it('doit retourner erreur 400 si lat est invalide', async () => {
      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=abc&lon=-73.6')
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.error).toBe('Paramètres invalides');
    });

    it('doit retourner erreur 400 si lon est hors limites', async () => {
      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-200')
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.error).toBe('Paramètres invalides');
    });

    it('doit accepter un nom personnalisé', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-73.6&nom=MaVille')
        .expect(200);

      expect(response.body.ville.nom).toBe('MaVille');
    });

    it('doit limiter le nom à 80 caractères', async () => {
      const longNom = 'a'.repeat(100);
      const response = await request(app)
        .get(`/api/previsions-coordonnees?lat=45.5&lon=-73.6&nom=${longNom}`)
        .expect(400);

      expect(response.body.status).toBe(400);
      expect(response.body.error).toBe('Paramètres invalides');
    });

    it('doit réutiliser le cache mais garder le nom de la requête', async () => {
      // La clé de cache est purement géographique : deux utilisateurs sur la
      // même position doivent partager les prévisions sans hériter du libellé
      // saisi par l'autre.
      const fetchMock = stubFetchJson(reponseOpenMeteo);

      const premiere = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-73.6&nom=Verdun')
        .expect(200);
      const seconde = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-73.6&nom=Rosemont')
        .expect(200);

      expect(premiere.body.depuisCache).toBe(false);
      expect(seconde.body.depuisCache).toBe(true);
      expect(seconde.body.ville.nom).toBe('Rosemont');
      expect(seconde.body.ville.latitude).toBe(45.5);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('doit utiliser le nom par défaut si non fourni', async () => {
      stubFetchJson(reponseOpenMeteo);

      const response = await request(app)
        .get('/api/previsions-coordonnees?lat=45.5&lon=-73.6')
        .expect(200);

      expect(response.body.ville.nom).toBe('Position personnalisée');
    });
  });
});
