import type { Request, Response } from 'express';
import { CITIES } from '../data/cities.js';
import { fetchForecast } from '../services/openmeteo.service.js';
import { avecCache, TTL } from '../services/cache.service.js';
import { NotFoundError } from '../lib/errors.js';
import { previsionsParVilleSchema, previsionsCoordonneesSchema } from '../schemas/validation.js';
import { detecterAlertes, redigerNotification } from '../services/detecteur-alertes.js';
import type { Previsions } from '../services/openmeteo.service.js';

/**
 * Alertes en vigueur pour ces prévisions, prêtes à afficher.
 *
 * Calculée *après* la lecture du cache, jamais dans la factory `avecCache` :
 * le libellé du lieu (`lieu`) vient de la requête, pas des données mises en
 * cache — même raisonnement que la ré-affectation de `ville.nom` plus bas dans
 * `getByCoordonnees`, où deux lieux voisins partagent la même clé arrondie
 * mais pas le même nom. `detecterAlertes`/`redigerNotification` sont les mêmes
 * fonctions pures que le cron de notifications push (`verificateur-alertes.ts`) :
 * un seul endroit décide de ce qui constitue une alerte et comment la rédiger.
 */
function alertesPour(previsions: Pick<Previsions, 'actuel' | 'horaire'>, lieu: string) {
  return detecterAlertes(previsions.actuel, previsions.horaire).map((a) => ({
    type: a.type,
    importante: a.importante,
    ...redigerNotification(a, lieu),
  }));
}

export default {
  getByVille: async (req: Request, res: Response) => {
    const { ville } = previsionsParVilleSchema.parse({ ville: req.params.ville });
    // `ville` vient d'Internet : sans `hasOwn`, les clés héritées d'Object
    // (`constructor`, `toString`, `valueOf`…) renvoient une valeur truthy qui
    // passe la garde ci-dessous, et l'appel amont part avec des coordonnées
    // `undefined` — 502 au lieu de 404, et un appel sortant offert à qui le demande.
    const city = Object.hasOwn(CITIES, ville) ? CITIES[ville] : undefined;

    if (!city) {
      throw new NotFoundError(
        `Ville inconnue. Villes disponibles : ${Object.keys(CITIES).join(', ')}.`
      );
    }

    const { data, depuisCache, obsolete } = await avecCache(
      `prev:${city.id}`,
      TTL.PREVISIONS,
      async () => ({
        ville: { id: city.id, nom: city.nom, latitude: city.latitude, longitude: city.longitude },
        ...(await fetchForecast(city)),
      })
    );

    res.origineCache = obsolete ? 'obsolete' : depuisCache ? 'frais' : 'amont';
    res.json({ ...data, alertes: alertesPour(data, city.nom), depuisCache, obsolete });
  },

  getByCoordonnees: async (req: Request, res: Response) => {
    const { lat, lon, nom } = previsionsCoordonneesSchema.parse(req.query);

    const { data, depuisCache, obsolete } = await avecCache(
      // Arrondi à deux décimales : la clé est pilotée depuis Internet, sans quoi
      // son espace serait illimité.
      `prev:${lat.toFixed(2)},${lon.toFixed(2)}`,
      TTL.PREVISIONS,
      async () => ({
        ville: { id: 'personnalise', nom, latitude: lat, longitude: lon },
        ...(await fetchForecast({ latitude: lat, longitude: lon })),
      })
    );

    res.origineCache = obsolete ? 'obsolete' : depuisCache ? 'frais' : 'amont';
    // Le `nom` accompagne la requête, pas les données : deux RTA voisines
    // partagent la même clé arrondie et doivent garder leur libellé. Les
    // alertes suivent la même règle — voir le commentaire d'`alertesPour`.
    res.json({
      ...data,
      ville: { ...((data as Record<string, unknown>).ville as object), nom },
      alertes: alertesPour(data, nom),
      depuisCache,
      obsolete,
    });
  },
};
