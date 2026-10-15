import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import * as prettier from 'prettier';
import {
  villeSchema,
  reponseMeteoSchema,
  lieuGeocodeSchema,
  framesRainViewerSchema,
  santeSchema,
  erreurSchema,
  clePubliqueSchema,
  abonnementConfirmeSchema,
} from '../src/schemas/openapi-reponses.js';

/**
 * Génère `frontend/src/lib/api-genere.ts` — les types des réponses de l'API —
 * depuis les schémas de `src/schemas/openapi-reponses.ts`.
 *
 * Ces schémas sont déjà la source de vérité de `/api/openapi.json`, et
 * `tests/integration/contrat-reponses.test.ts` vérifie que les contrôleurs les
 * respectent. Le frontend recopiait ces formes à la main : un champ renommé
 * côté backend cassait l'affichage sans qu'aucun outil ne le signale.
 *
 * Pas de bibliothèque : `openapi-typescript` exige TypeScript 5 (le dépôt est
 * en 6), et nos schémas n'emploient qu'une poignée de formes JSON Schema. Une
 * forme inconnue fait échouer la génération plutôt que d'être mal traduite.
 *
 * `npm run types:front` réécrit le fichier ; `tests/unit/types-front.test.ts`
 * fait échouer la CI s'il n'est plus à jour.
 */

/** Nom du type généré → schéma de réponse. L'ordre est celui du fichier produit. */
export const TYPES_GENERES: Record<string, z.ZodType> = {
  Ville: villeSchema,
  ReponseMeteo: reponseMeteoSchema,
  LieuGeocode: lieuGeocodeSchema,
  FramesRainViewer: framesRainViewerSchema,
  Sante: santeSchema,
  Erreur: erreurSchema,
  ClePublique: clePubliqueSchema,
  AbonnementConfirme: abonnementConfirmeSchema,
};

export const CHEMIN_SORTIE = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../frontend/src/lib/api-genere.ts'
);

interface Noeud {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  items?: Noeud;
  properties?: Record<string, Noeud>;
  required?: string[];
  additionalProperties?: boolean | Noeud;
  propertyNames?: Noeud;
  description?: string;
}

const CLES_CONNUES = new Set([
  '$schema',
  'type',
  'const',
  'enum',
  'items',
  'properties',
  'required',
  'additionalProperties',
  'propertyNames',
  'description',
]);

const PRIMITIFS: Record<string, string> = {
  string: 'string',
  number: 'number',
  integer: 'number',
  boolean: 'boolean',
  null: 'null',
};

function commentaire(description: string | undefined): string {
  return description ? `/** ${description} */\n` : '';
}

function traduire(noeud: Noeud, chemin: string): string {
  const inconnues = Object.keys(noeud).filter((cle) => !CLES_CONNUES.has(cle));
  if (inconnues.length) {
    throw new Error(`Forme JSON Schema non prise en charge en ${chemin} : ${inconnues.join(', ')}`);
  }

  if (noeud.const !== undefined) return JSON.stringify(noeud.const);
  if (noeud.enum) return noeud.enum.map((v) => JSON.stringify(v)).join(' | ');

  // `.nullable()` produit `type: ['number', 'null']`.
  if (Array.isArray(noeud.type)) {
    return noeud.type.map((t) => traduire({ ...noeud, type: t }, chemin)).join(' | ');
  }

  switch (noeud.type) {
    case 'array':
      if (!noeud.items) throw new Error(`Tableau sans items en ${chemin}`);
      return `${entreParentheses(traduire(noeud.items, `${chemin}[]`))}[]`;
    case 'object':
      return traduireObjet(noeud, chemin);
    default: {
      const primitif = noeud.type && PRIMITIFS[noeud.type];
      if (!primitif) throw new Error(`Type non pris en charge en ${chemin} : ${noeud.type}`);
      return primitif;
    }
  }
}

function entreParentheses(type: string): string {
  return type.includes(' | ') ? `(${type})` : type;
}

function traduireObjet(noeud: Noeud, chemin: string): string {
  // `z.record()` : clés libres, valeurs typées.
  if (noeud.properties === undefined && typeof noeud.additionalProperties === 'object') {
    return `Record<string, ${traduire(noeud.additionalProperties, `${chemin}{}`)}>`;
  }

  const requis = new Set(noeud.required ?? []);
  const champs = Object.entries(noeud.properties ?? {}).map(
    ([nom, enfant]) =>
      `${commentaire(enfant.description)}${nom}${requis.has(nom) ? '' : '?'}: ${traduire(
        enfant,
        `${chemin}.${nom}`
      )};`
  );
  return `{\n${champs.join('\n')}\n}`;
}

/** Contenu complet du fichier généré, formaté comme le reste du frontend. */
export async function genererTypesFront(): Promise<string> {
  const blocs = Object.entries(TYPES_GENERES).map(([nom, schema]) => {
    const json = z.toJSONSchema(schema) as Noeud;
    return `${commentaire(json.description)}export type ${nom} = ${traduire(json, nom)};`;
  });

  const source = [
    '// Fichier généré par `npm run types:front` (backend/scripts/generer-types-front.ts)',
    '// depuis backend/src/schemas/openapi-reponses.ts — ne pas modifier à la main.',
    '',
    blocs.join('\n\n'),
  ].join('\n');

  const options = await prettier.resolveConfig(CHEMIN_SORTIE);
  return prettier.format(source, { ...options, parser: 'typescript' });
}

// Exécuté directement (`npm run types:front`), pas à l'import par le test.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(CHEMIN_SORTIE, await genererTypesFront());
  console.log(`Types écrits dans ${CHEMIN_SORTIE}`);
}
