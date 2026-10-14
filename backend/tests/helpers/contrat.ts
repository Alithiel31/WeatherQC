import { expect } from 'vitest';
import type { z } from 'zod';

/**
 * Vérifie qu'un corps de réponse respecte *exactement* son schéma de
 * documentation (`src/schemas/openapi-reponses.ts`).
 *
 * Deux contrôles :
 * - le corps passe le schéma — types, champs requis, valeurs d'énumération ;
 * - rien ne dépasse. Zod retire en silence les clés qu'il ne connaît pas :
 *   si la sortie de `parse` diffère du corps reçu, c'est qu'un champ renvoyé
 *   n'est pas documenté. Le contrôle vaut à toutes les profondeurs, sans
 *   rendre les schémas stricts — le document OpenAPI publié reste inchangé.
 */
export function attendreConforme(schema: z.ZodType, corps: unknown): void {
  const analyse = schema.safeParse(corps);

  if (!analyse.success) {
    const ecarts = analyse.error.issues
      .map((e) => `  ${e.path.join('.') || '(racine)'} : ${e.message}`)
      .join('\n');
    expect.fail(`Réponse non conforme à son schéma OpenAPI :\n${ecarts}`);
  }

  expect(analyse.data, 'La réponse porte des champs absents du schéma OpenAPI').toEqual(corps);
}
