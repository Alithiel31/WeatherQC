import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import { z } from 'zod';
import app from '../../src/index.js';
import { config } from '../../src/config.js';
import { openapiDocument } from '../../src/openapi.js';
import {
  villeSchema,
  reponseMeteoSchema,
  lieuGeocodeSchema,
  framesRainViewerSchema,
  santeSchema,
  erreurSchema,
  clePubliqueSchema,
  abonnementConfirmeSchema,
} from '../../src/schemas/openapi-reponses.js';
import { reponseOpenMeteo } from '../fixtures/openmeteo.js';
import { reponseZippopotam } from '../fixtures/zippopotam.js';
import { reponseGeocodageMontreal } from '../fixtures/openmeteo-geocoding.js';
import { indexRainViewer } from '../fixtures/rainviewer.js';
import { stubFetchJson } from '../helpers/fetch.js';
import { attendreConforme } from '../helpers/contrat.js';

/**
 * Contrat des réponses : chaque couple méthode + statut que documente
 * `/api/openapi.json` est rejoué ici contre l'application réelle, et le corps
 * comparé à son schéma de `openapi-reponses.ts`.
 *
 * Sans ce test, ces schémas ne servaient qu'à produire la documentation : un
 * champ renommé, retiré ou ajouté par un contrôleur la rendait fausse sans que
 * rien ne le signale — et le frontend, qui recopie ces formes à la main dans
 * `frontend/src/lib/types.ts`, cassait en silence.
 */

const VAPID_TEST = {
  publicKey: 'clé-publique-test',
  privateKey: 'clé-privée-test',
  contact: 'mailto:test@exemple.com',
};

const ABONNEMENT = {
  ville: 'montreal',
  subscription: {
    endpoint: 'https://fcm.googleapis.com/fcm/send/contrat',
    keys: { p256dh: 'clé-p256dh', auth: 'clé-auth' },
  },
};

interface Cas {
  /** `méthode chemin-documenté statut`, tel que l'énumère `openapiDocument.paths`. */
  operation: string;
  libelle: string;
  statut: number;
  requete: () => Promise<request.Response>;
  /** `null` : réponse sans corps (204). */
  schema: z.ZodType | null;
}

const CAS: Cas[] = [
  {
    operation: 'get /api/villes 200',
    libelle: 'liste des villes',
    statut: 200,
    requete: () => request(app).get('/api/villes'),
    schema: z.array(villeSchema),
  },
  {
    operation: 'get /api/previsions/{ville} 200',
    libelle: 'prévisions fraîches',
    statut: 200,
    requete: () => {
      stubFetchJson(reponseOpenMeteo);
      return request(app).get('/api/previsions/montreal');
    },
    schema: reponseMeteoSchema,
  },
  {
    operation: 'get /api/previsions/{ville} 200',
    libelle: 'prévisions périmées servies pendant une panne amont',
    statut: 200,
    requete: async () => {
      stubFetchJson(reponseOpenMeteo);
      await request(app).get('/api/previsions/montreal').expect(200);

      stubFetchJson({}, 500);
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.setSystemTime(Date.now() + config.cache.ttlPrevisions + 1000);
      return request(app).get('/api/previsions/montreal');
    },
    schema: reponseMeteoSchema,
  },
  {
    operation: 'get /api/previsions/{ville} 404',
    libelle: 'ville inconnue',
    statut: 404,
    requete: () => request(app).get('/api/previsions/nulle-part'),
    schema: erreurSchema,
  },
  {
    operation: 'get /api/previsions/{ville} default',
    libelle: 'amont en erreur',
    statut: 502,
    requete: () => {
      stubFetchJson({}, 500);
      return request(app).get('/api/previsions/montreal');
    },
    schema: erreurSchema,
  },
  {
    operation: 'get /api/previsions-coordonnees 200',
    libelle: 'prévisions par coordonnées',
    statut: 200,
    requete: () => {
      stubFetchJson(reponseOpenMeteo);
      return request(app).get('/api/previsions-coordonnees?lat=45.5&lon=-73.6&nom=Ici');
    },
    schema: reponseMeteoSchema,
  },
  {
    operation: 'get /api/previsions-coordonnees 400',
    libelle: 'latitude hors bornes',
    statut: 400,
    requete: () => request(app).get('/api/previsions-coordonnees?lat=200&lon=-73.6'),
    schema: erreurSchema,
  },
  {
    operation: 'get /api/previsions-coordonnees default',
    libelle: 'amont injoignable',
    statut: 502,
    requete: () => {
      stubFetchJson({}, 500);
      return request(app).get('/api/previsions-coordonnees?lat=45.5&lon=-73.6');
    },
    schema: erreurSchema,
  },
  {
    operation: 'get /api/geocode/{codePostal} 200',
    libelle: 'RTA géocodée',
    statut: 200,
    requete: () => {
      stubFetchJson(reponseZippopotam);
      return request(app).get('/api/geocode/H2X');
    },
    schema: lieuGeocodeSchema,
  },
  {
    operation: 'get /api/geocode/{codePostal} 400',
    libelle: 'format invalide',
    statut: 400,
    requete: () => request(app).get('/api/geocode/123'),
    schema: erreurSchema,
  },
  {
    operation: 'get /api/geocode/{codePostal} 404',
    libelle: 'RTA inexistante',
    statut: 404,
    requete: () => {
      stubFetchJson({}, 404);
      return request(app).get('/api/geocode/G9Z');
    },
    schema: erreurSchema,
  },
  {
    operation: 'get /api/geocode/{codePostal} default',
    libelle: 'amont en erreur',
    statut: 502,
    requete: () => {
      stubFetchJson({}, 500);
      return request(app).get('/api/geocode/H2X');
    },
    schema: erreurSchema,
  },
  {
    operation: 'get /api/geocode-ville/{nom} 200',
    libelle: 'ville géocodée',
    statut: 200,
    requete: () => {
      stubFetchJson(reponseGeocodageMontreal);
      return request(app).get('/api/geocode-ville/Montreal');
    },
    schema: lieuGeocodeSchema,
  },
  {
    operation: 'get /api/geocode-ville/{nom} 400',
    libelle: 'nom trop court',
    statut: 400,
    requete: () => request(app).get('/api/geocode-ville/M'),
    schema: erreurSchema,
  },
  {
    operation: 'get /api/geocode-ville/{nom} 404',
    libelle: 'aucune ville québécoise',
    statut: 404,
    requete: () => {
      stubFetchJson({});
      return request(app).get('/api/geocode-ville/Villeinexistante');
    },
    schema: erreurSchema,
  },
  {
    operation: 'get /api/geocode-ville/{nom} default',
    libelle: 'amont en erreur',
    statut: 502,
    requete: () => {
      stubFetchJson({}, 500);
      return request(app).get('/api/geocode-ville/Montreal');
    },
    schema: erreurSchema,
  },
  {
    operation: 'get /api/rainviewer 200',
    libelle: 'index des images',
    statut: 200,
    requete: () => {
      stubFetchJson(indexRainViewer);
      return request(app).get('/api/rainviewer');
    },
    schema: framesRainViewerSchema,
  },
  {
    operation: 'get /api/rainviewer default',
    libelle: 'amont en erreur',
    statut: 502,
    requete: () => {
      stubFetchJson({}, 500);
      return request(app).get('/api/rainviewer');
    },
    schema: erreurSchema,
  },
  {
    operation: 'get /api/sante 200',
    libelle: 'diagnostic, cache et disjoncteurs remplis',
    statut: 200,
    requete: async () => {
      stubFetchJson(reponseOpenMeteo);
      await request(app).get('/api/previsions/montreal').expect(200);
      return request(app).get('/api/sante');
    },
    schema: santeSchema,
  },
  {
    operation: 'get /api/notifications/cle-publique 200',
    libelle: 'clé publique VAPID',
    statut: 200,
    requete: () => {
      config.vapid = VAPID_TEST;
      return request(app).get('/api/notifications/cle-publique');
    },
    schema: clePubliqueSchema,
  },
  {
    operation: 'get /api/notifications/cle-publique 503',
    libelle: 'clés VAPID absentes',
    statut: 503,
    requete: () => {
      config.vapid = null;
      return request(app).get('/api/notifications/cle-publique');
    },
    schema: erreurSchema,
  },
  {
    operation: 'post /api/notifications/abonnement 201',
    libelle: 'abonnement enregistré',
    statut: 201,
    requete: () => {
      config.vapid = VAPID_TEST;
      return request(app).post('/api/notifications/abonnement').send(ABONNEMENT);
    },
    schema: abonnementConfirmeSchema,
  },
  {
    operation: 'post /api/notifications/abonnement 400',
    libelle: 'corps invalide',
    statut: 400,
    requete: () => {
      config.vapid = VAPID_TEST;
      return request(app).post('/api/notifications/abonnement').send({ ville: 'montreal' });
    },
    schema: erreurSchema,
  },
  {
    operation: 'post /api/notifications/abonnement 404',
    libelle: 'ville inconnue',
    statut: 404,
    requete: () => {
      config.vapid = VAPID_TEST;
      return request(app)
        .post('/api/notifications/abonnement')
        .send({ ...ABONNEMENT, ville: 'nulle-part' });
    },
    schema: erreurSchema,
  },
  {
    operation: 'post /api/notifications/abonnement 503',
    libelle: 'clés VAPID absentes',
    statut: 503,
    requete: () => {
      config.vapid = null;
      return request(app).post('/api/notifications/abonnement').send(ABONNEMENT);
    },
    schema: erreurSchema,
  },
  {
    operation: 'delete /api/notifications/abonnement 204',
    libelle: 'désabonnement',
    statut: 204,
    requete: () =>
      request(app)
        .delete('/api/notifications/abonnement')
        .send({ endpoint: ABONNEMENT.subscription.endpoint }),
    schema: null,
  },
  {
    operation: 'delete /api/notifications/abonnement 400',
    libelle: 'corps invalide',
    statut: 400,
    requete: () => request(app).delete('/api/notifications/abonnement').send({}),
    schema: erreurSchema,
  },
];

describe('Contrat des réponses — conformité au document OpenAPI', () => {
  const vapidOriginal = config.vapid;

  afterEach(() => {
    config.vapid = vapidOriginal;
    vi.useRealTimers();
  });

  it.each(CAS.map((c) => [`${c.operation} (${c.libelle})`, c] as const))(
    '%s',
    async (_titre, cas) => {
      const reponse = await cas.requete();

      expect(reponse.status).toBe(cas.statut);
      if (cas.schema === null) {
        expect(reponse.body).toEqual({});
        expect(reponse.text).toBe('');
      } else {
        attendreConforme(cas.schema, reponse.body);
      }
    }
  );

  // Une route ou un statut ajouté à la documentation sans cas ci-dessus ferait
  // échouer ce test : la doc ne peut plus promettre ce que personne ne vérifie.
  it('couvre chaque couple méthode + statut documenté', () => {
    const documentes = Object.entries(openapiDocument.paths).flatMap(([chemin, methodes]) =>
      Object.entries(methodes).flatMap(([methode, operation]) =>
        Object.keys((operation as { responses: object }).responses).map(
          (statut) => `${methode} ${chemin} ${statut}`
        )
      )
    );
    const couverts = new Set(CAS.map((c) => c.operation));

    expect(documentes.filter((o) => !couverts.has(o))).toEqual([]);
    // Et l'inverse : un cas ne doit pas viser une opération que la doc ignore.
    expect([...couverts].filter((o) => !documentes.includes(o))).toEqual([]);
  });
});
