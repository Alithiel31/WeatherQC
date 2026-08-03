import { z } from 'zod';

/**
 * Contrat attendu de Zippopotam pour `GET /ca/{rta}`.
 *
 * Latitude et longitude arrivent en chaînes — c'est le contrat réel de l'API,
 * d'où le `parseFloat` du service. Une dérive de type sera signalée par le
 * workflow de contrat nocturne plutôt que de produire des `NaN` silencieux.
 */
export const reponseZippopotamSchema = z.object({
  places: z.array(
    z.object({
      'place name': z.string(),
      state: z.string(),
      latitude: z.string(),
      longitude: z.string(),
    })
  ),
});

export type ReponseZippopotam = z.infer<typeof reponseZippopotamSchema>;
