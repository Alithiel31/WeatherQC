import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/index.js';
import { reponseOpenMeteo } from '../fixtures/openmeteo.js';
import { config } from '../../src/config.js';

/**
 * Comportement de l'API quand un amont tombe.
 *
 * Avant : le cache était supprimé dès sa péremption, chaque requête repartait
 * chez le fournisseur, et dix minutes après le début d'une panne Open-Meteo
 * tout le monde voyait un écran d'erreur — y compris les visiteurs dont
 * l'appareil détenait des prévisions parfaitement utilisables.
 */

/** `fetch` qui répond une fois, puis tombe en panne. */
function fetchQuiTombe(reponses: number) {
  let restantes = reponses;
  return vi.fn(async () => {
    if (restantes-- > 0) {
      return { ok: true, status: 200, json: async () => reponseOpenMeteo } as unknown as Response;
    }
    throw new TypeError('fetch failed');
  });
}

describe('Service dégradé', () => {
  it('sert des prévisions périmées plutôt qu’une erreur', async () => {
    const mock = fetchQuiTombe(1);
    vi.stubGlobal('fetch', mock);

    const premiere = await request(app).get('/api/previsions/montreal').expect(200);
    expect(premiere.body.obsolete).toBe(false);

    // On force la péremption sans attendre le TTL réel.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(Date.now() + config.cache.ttlPrevisions + 1000);
    try {
      const seconde = await request(app).get('/api/previsions/montreal').expect(200);

      expect(seconde.body.obsolete).toBe(true);
      expect(seconde.body.depuisCache).toBe(true);
      expect(seconde.body.actuel).toEqual(premiere.body.actuel);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rend une erreur quand il n’y a rien de servable', async () => {
    vi.stubGlobal('fetch', fetchQuiTombe(0));

    const reponse = await request(app).get('/api/previsions/montreal').expect(502);

    expect(reponse.body.status).toBe(502);
  });

  it('ne lance qu’un appel amont pour des requêtes simultanées', async () => {
    // Le TTL est fixe : toutes les clés chaudes expirent ensemble, et la rafale
    // suivante partait autrefois en entier chez le fournisseur.
    const mock = fetchQuiTombe(10);
    vi.stubGlobal('fetch', mock);

    await Promise.all(
      Array.from({ length: 10 }, () => request(app).get('/api/previsions/montreal').expect(200))
    );

    expect(mock).toHaveBeenCalledTimes(1);
  });
});

describe('Disjoncteur amont', () => {
  it('cesse d’appeler un amont en panne répétée et répond 503', async () => {
    vi.stubGlobal('fetch', fetchQuiTombe(0));

    // Chaque requête consomme deux tentatives : le seuil est atteint d'autant
    // plus vite. On boucle jusqu'à l'ouverture, sans dépasser le quota d'API.
    let dernier = 0;
    for (let i = 0; i < config.breaker.seuilEchecs + 1; i++) {
      const reponse = await request(app).get('/api/previsions/montreal');
      dernier = reponse.status;
      if (dernier === 503) break;
    }

    expect(dernier).toBe(503);

    const sante = await request(app).get('/api/sante').expect(200);
    expect(sante.body.amonts['Open-Meteo'].etat).toBe('ouvert');
  });

  it('échoue sans toucher au réseau une fois ouvert', async () => {
    const mock = fetchQuiTombe(0);
    vi.stubGlobal('fetch', mock);

    for (let i = 0; i < config.breaker.seuilEchecs + 1; i++) {
      const reponse = await request(app).get('/api/previsions/montreal');
      if (reponse.status === 503) break;
    }

    const appelsAvant = mock.mock.calls.length;
    await request(app).get('/api/previsions/montreal').expect(503);

    // C'est tout l'intérêt : plus aucune connexion tenue dix secondes.
    expect(mock.mock.calls.length).toBe(appelsAvant);
  });
});
