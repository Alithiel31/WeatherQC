import { z } from 'zod';
import {
  previsionsParVilleSchema,
  previsionsCoordonneesSchema,
  geocodeSchema,
  abonnementSchema,
  desabonnementSchema,
} from './schemas/validation.js';
import {
  villesSchema,
  reponseMeteoSchema,
  lieuGeocodeSchema,
  framesRainViewerSchema,
  santeSchema,
  erreurSchema,
  clePubliqueSchema,
  abonnementConfirmeSchema,
} from './schemas/openapi-reponses.js';

/**
 * Document OpenAPI 3.1, assemblé au démarrage plutôt qu'écrit à la main.
 *
 * Les paramètres de chaque route sont dérivés des mêmes schémas Zod que ceux
 * qui valident réellement la requête (`schemas/validation.ts`) : un champ
 * ajouté, renommé ou resserré s'y reflète tout seul, sans repasser par une
 * spec qu'on oublierait de tenir à jour. Les corps de réponse n'ont pas cette
 * garantie — voir le commentaire de `schemas/openapi-reponses.ts`.
 *
 * `io: 'input'` sur les paramètres : sans lui, un champ portant un `.default()`
 * (`nom` sur `/api/previsions-coordonnees`) ressort marqué requis, puisque la
 * *sortie* de Zod le contient toujours. Ce qui compte pour un paramètre HTTP,
 * c'est ce que l'appelant doit fournir en *entrée* — les deux ne coïncident
 * pas dès qu'un défaut existe.
 */

interface SchemaJson {
  properties?: Record<string, unknown>;
  required?: string[];
}

function parametres(schema: z.ZodType, dans: 'path' | 'query') {
  const { properties = {}, required = [] } = z.toJSONSchema(schema, {
    io: 'input',
  }) as SchemaJson;

  return Object.entries(properties).map(([nom, schemaChamp]) => ({
    name: nom,
    in: dans,
    // Un segment de chemin est toujours requis en OpenAPI, même si son champ
    // Zod porte un défaut — il n'existe pas de route sans ce segment.
    required: dans === 'path' ? true : required.includes(nom),
    schema: schemaChamp,
  }));
}

/**
 * `z.toJSONSchema` pose `$schema` à la racine de chaque appel — pertinent pour
 * un fichier JSON Schema autonome, redondant une fois embarqué comme `schema`
 * d'un corps OpenAPI, où le dialecte se déclare une seule fois au niveau du
 * document (`jsonSchemaDialect` ci-dessous).
 */
function schemaJson(schema: z.ZodType): Record<string, unknown> {
  const resultat = z.toJSONSchema(schema) as Record<string, unknown>;
  delete resultat.$schema;
  return resultat;
}

const corpsJson = (schema: z.ZodType) => ({
  content: { 'application/json': { schema: schemaJson(schema) } },
});

const reponseErreur = (description: string) => ({ description, ...corpsJson(erreurSchema) });
const reponseJson = (description: string, schema: z.ZodType) => ({
  description,
  ...corpsJson(schema),
});

// Toutes les erreurs — amont en panne, disjoncteur ouvert, quota dépassé —
// partagent cette même enveloppe, quel que soit le code HTTP exact. Autant le
// dire une fois en `default` que le répéter sur chaque route.
const AMONT_INDISPONIBLE = reponseErreur(
  'Amont indisponible (502/503/504) ou quota dépassé (429).'
);

export const openapiDocument = {
  openapi: '3.1.0',
  jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  info: {
    title: 'Météo Québec — API',
    version: '1.0.0',
    description:
      'Proxy Open-Meteo / Zippopotam / RainViewer avec cache, disjoncteur et ' +
      "limitation de débit. Le README du dépôt détaille les variables d'environnement " +
      'et les mécanismes de résilience.',
  },
  servers: [{ url: '/', description: 'Same-origin, derrière nginx en production' }],
  paths: {
    '/api/villes': {
      get: {
        summary: 'Liste des villes disponibles',
        responses: { '200': reponseJson('Villes disponibles', villesSchema) },
      },
    },
    '/api/previsions/{ville}': {
      get: {
        summary: 'Prévisions par ville',
        parameters: parametres(previsionsParVilleSchema, 'path'),
        responses: {
          '200': reponseJson('Prévisions courantes, horaires et quotidiennes', reponseMeteoSchema),
          '404': reponseErreur('Ville inconnue'),
          default: AMONT_INDISPONIBLE,
        },
      },
    },
    '/api/previsions-coordonnees': {
      get: {
        summary: 'Prévisions pour un point GPS',
        parameters: parametres(previsionsCoordonneesSchema, 'query'),
        responses: {
          '200': reponseJson('Prévisions courantes, horaires et quotidiennes', reponseMeteoSchema),
          '400': reponseErreur('Paramètres invalides (lat/lon hors bornes, etc.)'),
          default: AMONT_INDISPONIBLE,
        },
      },
    },
    '/api/geocode/{codePostal}': {
      get: {
        summary: 'Géocode une RTA québécoise (ex. H2X)',
        parameters: parametres(geocodeSchema, 'path'),
        responses: {
          '200': reponseJson('Lieu géocodé', lieuGeocodeSchema),
          '400': reponseErreur('Format de code postal invalide'),
          '404': reponseErreur('Code postal introuvable'),
          default: AMONT_INDISPONIBLE,
        },
      },
    },
    '/api/rainviewer': {
      get: {
        summary: 'Index des images satellite et radar RainViewer',
        responses: {
          '200': reponseJson('Frames disponibles', framesRainViewerSchema),
          default: AMONT_INDISPONIBLE,
        },
      },
    },
    '/api/sante': {
      get: {
        summary: 'État du service (healthcheck)',
        responses: { '200': reponseJson('Diagnostic', santeSchema) },
      },
    },
    '/api/notifications/cle-publique': {
      get: {
        summary: 'Clé publique VAPID pour l’abonnement aux notifications push',
        responses: {
          '200': reponseJson('Clé publique', clePubliqueSchema),
          '503': reponseErreur('Notifications indisponibles — clés VAPID non configurées'),
        },
      },
    },
    '/api/notifications/abonnement': {
      post: {
        summary: 'Abonne un navigateur aux alertes météo d’une ville',
        requestBody: corpsJson(abonnementSchema),
        responses: {
          '201': reponseJson('Abonnement enregistré', abonnementConfirmeSchema),
          '400': reponseErreur('Corps invalide (endpoint, clés ou ville manquants/malformés)'),
          '404': reponseErreur('Ville inconnue'),
          '503': reponseErreur('Notifications indisponibles — clés VAPID non configurées'),
        },
      },
      delete: {
        summary: 'Désabonne un navigateur des alertes météo',
        requestBody: corpsJson(desabonnementSchema),
        responses: {
          '204': {
            description: 'Désabonné (idempotent — un endpoint déjà absent répond aussi 204)',
          },
          '400': reponseErreur('Corps invalide'),
        },
      },
    },
  },
};
