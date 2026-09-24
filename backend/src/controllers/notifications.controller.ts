import type { Request, Response } from 'express';
import { CITIES } from '../data/cities.js';
import { config } from '../config.js';
import { NotFoundError, ServiceIndisponibleError } from '../lib/errors.js';
import { abonnementSchema, desabonnementSchema } from '../schemas/validation.js';
import { ajouterAbonnement, supprimerAbonnement } from '../services/abonnements.service.js';
import { clePubliqueSchema, abonnementConfirmeSchema } from '../schemas/openapi-reponses.js';
import { envoyerJson } from '../lib/reponse.js';

const MESSAGE_VAPID_ABSENT =
  'Notifications indisponibles — clés VAPID non configurées côté serveur.';

export default {
  clePublique: (_req: Request, res: Response) => {
    if (!config.vapid) throw new ServiceIndisponibleError(MESSAGE_VAPID_ABSENT);
    envoyerJson(res, clePubliqueSchema, { clePublique: config.vapid.publicKey });
  },

  sAbonner: (req: Request, res: Response) => {
    if (!config.vapid) throw new ServiceIndisponibleError(MESSAGE_VAPID_ABSENT);

    const { ville, subscription } = abonnementSchema.parse(req.body);

    // Même garde que `previsions.controller.ts` : `hasOwn` plutôt qu'un accès
    // direct, pour qu'une clé héritée d'Object ne passe pas la vérification.
    if (!Object.hasOwn(CITIES, ville)) {
      throw new NotFoundError(
        `Ville inconnue. Villes disponibles : ${Object.keys(CITIES).join(', ')}.`
      );
    }

    ajouterAbonnement({
      ville,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    });

    envoyerJson(res, abonnementConfirmeSchema, { statut: 'abonne' }, 201);
  },

  // Idempotent à dessein : désabonner un endpoint déjà absent (double clic,
  // notification déjà nettoyée par le vérificateur horaire après un 410) rend
  // 204 comme un désabonnement réussi, jamais une erreur.
  seDesabonner: (req: Request, res: Response) => {
    const { endpoint } = desabonnementSchema.parse(req.body);
    supprimerAbonnement(endpoint);
    res.status(204).end();
  },
};
