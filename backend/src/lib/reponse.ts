import type { Response } from 'express';
import type { z } from 'zod';

/**
 * Valide le corps d'une réponse contre son schéma avant de l'envoyer. Une
 * violation lève une `Error` ordinaire — jamais la `ZodError` elle-même — pour
 * que `zod-error-handler.ts` (qui ne traite que `instanceof ZodError`) la
 * laisse passer vers le fallback 500 générique de `global-error-handler.ts`,
 * au lieu de la faire répondre 400 « Paramètres invalides » comme si la faute
 * venait du client. Renvoie `resultat.data` : toute propriété hors schéma est
 * silencieusement retirée avant d'atteindre le client.
 */
export function envoyerJson<T>(res: Response, schema: z.ZodType<T>, corps: T, statut = 200): void {
  const resultat = schema.safeParse(corps);
  if (!resultat.success) {
    throw new Error(
      `Réponse sortante invalide : ${resultat.error.issues
        .map((e) => `${e.path.join('.')} — ${e.message}`)
        .join('; ')}`
    );
  }
  res.status(statut).json(resultat.data);
}
