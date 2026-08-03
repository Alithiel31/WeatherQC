import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';

/**
 * La liste des origines autorisées est construite à l'import de `src/index.js`,
 * à partir de `TAILSCALE_IP` et `PUBLIC_ORIGINS`. Chaque cas doit donc repartir
 * d'un registre de modules vierge pour que les variables soient relues.
 */
async function chargerApp(tailscaleIp?: string, publicOrigins?: string) {
  vi.resetModules();
  if (tailscaleIp) process.env.TAILSCALE_IP = tailscaleIp;
  else delete process.env.TAILSCALE_IP;

  if (publicOrigins !== undefined) process.env.PUBLIC_ORIGINS = publicOrigins;
  else delete process.env.PUBLIC_ORIGINS;

  const { default: app } = await import('../../src/index.js');
  return app;
}

afterEach(() => {
  delete process.env.TAILSCALE_IP;
  delete process.env.PUBLIC_ORIGINS;
});

describe('Origines CORS autorisées', () => {
  it('autorise le poste de développement local', async () => {
    const app = await chargerApp();

    const res = await request(app).get('/api/sante').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('autorise l’IP Tailscale quand elle est configurée', async () => {
    const app = await chargerApp('100.64.0.1');

    const res = await request(app).get('/api/sante').set('Origin', 'http://100.64.0.1:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://100.64.0.1:5173');
  });

  it('autorise aussi l’IP Tailscale sans port', async () => {
    const app = await chargerApp('100.64.0.1');

    const res = await request(app).get('/api/sante').set('Origin', 'http://100.64.0.1');

    expect(res.headers['access-control-allow-origin']).toBe('http://100.64.0.1');
  });

  it('n’autorise pas une origine tierce', async () => {
    const app = await chargerApp('100.64.0.1');

    const res = await request(app).get('/api/sante').set('Origin', 'https://exemple.invalid');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('n’autorise aucune IP Tailscale quand la variable est absente', async () => {
    const app = await chargerApp();

    const res = await request(app).get('/api/sante').set('Origin', 'http://100.64.0.1:5173');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('Origines CORS déclarées par PUBLIC_ORIGINS', () => {
  it('autorise le domaine public de production', async () => {
    // Absent de l'allowlist jusqu'ici : nginx proxifie `/api/` en same-origin,
    // donc l'oubli ne se voyait sur aucune requête réelle.
    const app = await chargerApp(undefined, 'https://qcweather.alithiel31.dev');

    const res = await request(app)
      .get('/api/sante')
      .set('Origin', 'https://qcweather.alithiel31.dev');

    expect(res.headers['access-control-allow-origin']).toBe('https://qcweather.alithiel31.dev');
  });

  it('accepte plusieurs origines séparées par des virgules', async () => {
    const app = await chargerApp(undefined, 'https://a.exemple.com, https://b.exemple.com');

    for (const origine of ['https://a.exemple.com', 'https://b.exemple.com']) {
      const res = await request(app).get('/api/sante').set('Origin', origine);
      expect(res.headers['access-control-allow-origin']).toBe(origine);
    }
  });

  it('ignore la barre oblique finale', async () => {
    // Les navigateurs envoient `https://exemple.com` sans barre finale : sans
    // normalisation, `https://exemple.com/` en `.env` n'aurait jamais matché.
    const app = await chargerApp(undefined, 'https://exemple.com/');

    const res = await request(app).get('/api/sante').set('Origin', 'https://exemple.com');

    expect(res.headers['access-control-allow-origin']).toBe('https://exemple.com');
  });

  it('conserve les origines de développement quand la variable est posée', async () => {
    const app = await chargerApp(undefined, 'https://qcweather.alithiel31.dev');

    const res = await request(app).get('/api/sante').set('Origin', 'http://localhost:5173');

    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('n’autorise rien de plus quand la variable est vide', async () => {
    // Une variable laissée vide donnerait `['']` sans le filtre du préprocesseur.
    const app = await chargerApp(undefined, '');

    const res = await request(app).get('/api/sante').set('Origin', 'https://exemple.invalid');

    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('fait échouer le démarrage sur une origine sans schéma', async () => {
    vi.resetModules();
    process.env.PUBLIC_ORIGINS = 'qcweather.alithiel31.dev';

    await expect(import('../../src/index.js')).rejects.toThrow(/PUBLIC_ORIGINS/);
  });
});
