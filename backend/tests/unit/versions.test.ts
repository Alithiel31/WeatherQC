import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { openapiDocument } from '../../src/openapi.js';

/**
 * Une seule version pour tout le dépôt : celle de la dernière release du
 * CHANGELOG. Les numéros avaient dérivé chacun de leur côté (racine 1.0.0,
 * backend et frontend 2.0.0, OpenAPI 1.0.0, Android « 3 ») alors que la
 * release publiée était la 3.2.0 — personne ne savait plus laquelle croire.
 *
 * À chaque release : nouvelle section `## [x.y.z]` dans le CHANGELOG, puis la
 * même version partout ci-dessous. Ce test fait échouer la CI si un fichier
 * est oublié.
 */
const racine = resolve(__dirname, '../../..');
const lire = (chemin: string) => readFileSync(resolve(racine, chemin), 'utf8');
const versionPackage = (chemin: string) =>
  (JSON.parse(lire(chemin)) as { version: string }).version;

function derniereRelease(): string {
  const m = lire('CHANGELOG.md').match(/^## \[(\d+\.\d+\.\d+)\]/m);
  if (!m) throw new Error('Aucune section `## [x.y.z]` dans CHANGELOG.md');
  return m[1];
}

describe('cohérence des numéros de version', () => {
  const attendue = derniereRelease();

  it.each(['package.json', 'backend/package.json', 'frontend/package.json'])(
    '%s porte la version de la dernière release',
    (chemin) => {
      expect(versionPackage(chemin)).toBe(attendue);
    }
  );

  it('le document OpenAPI porte la version de la dernière release', () => {
    expect(openapiDocument.info.version).toBe(attendue);
  });

  it('l’application Android porte la version de la dernière release', () => {
    const gradle = lire('twa-qcweather/app/build.gradle').match(/^\s*versionName "([^"]+)"/m);
    const manifeste = JSON.parse(lire('twa-qcweather/twa-manifest.json')) as {
      appVersionName: string;
      appVersion: string;
    };

    expect(gradle?.[1]).toBe(attendue);
    expect(manifeste.appVersionName).toBe(attendue);
    expect(manifeste.appVersion).toBe(attendue);
  });
});
