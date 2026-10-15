import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * `nginx.conf` refuse géolocalisation, micro et caméra à toute la page. C'est
 * voulu — l'application n'en a pas besoin — mais le jour où une fonction
 * « ma position » appellera `navigator.geolocation`, le navigateur la refusera
 * *en silence* : pas d'invite, juste un `PERMISSION_DENIED`, et rien en
 * développement (le serveur Vite ne pose pas l'en-tête). Ce test fait le lien.
 */
const racine = resolve(__dirname, '../..');
const nginx = readFileSync(resolve(racine, 'nginx.conf'), 'utf8');

/** Directives de `Permissions-Policy`, ex. `{ geolocation: '()', camera: '()' }`. */
function politique(): Record<string, string> {
  const m = nginx.match(/add_header Permissions-Policy "([^"]+)"/);
  if (!m) throw new Error('En-tête Permissions-Policy introuvable dans nginx.conf');
  return Object.fromEntries(
    m[1].split(',').map((d) => {
      const [nom, valeur] = d.trim().split('=');
      return [nom, valeur];
    })
  );
}

function sources(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) return sources(chemin);
    return /\.(ts|svelte)$/.test(e.name) ? [chemin] : [];
  });
}

/** Directive → motifs qui trahissent l'usage de l'API correspondante. */
const USAGES: Record<string, RegExp> = {
  geolocation: /navigator\.geolocation/,
  camera: /getUserMedia|getDisplayMedia|ImageCapture/,
  microphone: /getUserMedia|MediaRecorder|SpeechRecognition/,
};

describe('Permissions-Policy de nginx.conf', () => {
  const directives = politique();
  const fichiers = sources(resolve(racine, 'src'));

  it('reste posée, et refuse au moins les trois API sensibles', () => {
    expect(Object.keys(directives)).toEqual(
      expect.arrayContaining(['geolocation', 'microphone', 'camera'])
    );
  });

  it.each(Object.keys(USAGES))('n’interdit pas %s si le code s’en sert', (directive) => {
    const utilisateurs = fichiers
      .filter((f) => USAGES[directive].test(readFileSync(f, 'utf8')))
      .map((f) => relative(racine, f));

    if (utilisateurs.length > 0) {
      expect(
        directives[directive],
        `${utilisateurs.join(', ')} utilise ${directive}, que nginx.conf interdit : ` +
          `passer « ${directive}=() » à « ${directive}=(self) » dans Permissions-Policy`
      ).not.toBe('()');
    }
  });
});
