import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';

/**
 * La liste des origines autorisées est construite à l'import de `src/index.js`,
 * à partir de `TAILSCALE_IP`. Chaque cas doit donc repartir d'un registre de
 * modules vierge pour que la variable d'environnement soit relue.
 */
async function chargerApp(tailscaleIp?: string) {
  vi.resetModules();
  if (tailscaleIp) process.env.TAILSCALE_IP = tailscaleIp;
  else delete process.env.TAILSCALE_IP;

  const { default: app } = await import('../../src/index.js');
  return app;
}

afterEach(() => {
  delete process.env.TAILSCALE_IP;
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
