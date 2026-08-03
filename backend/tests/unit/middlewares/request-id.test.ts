import { describe, it, expect, vi } from 'vitest';
import { requestId } from '../../../src/middlewares/request-id.js';
import type { Request, Response, NextFunction } from 'express';

function faireRequete(entete?: string) {
  const req = { get: vi.fn(() => entete) } as unknown as Request;
  const res = { setHeader: vi.fn() } as unknown as Response;
  const next = vi.fn() as NextFunction;

  requestId(req, res, next);

  return { req, res, next };
}

describe('requestId', () => {
  it('génère un identifiant quand le client n’en fournit pas', () => {
    const { req, next } = faireRequete(undefined);

    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(next).toHaveBeenCalledOnce();
  });

  it('renvoie l’identifiant en en-tête', () => {
    const { req, res } = faireRequete(undefined);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.id);
  });

  // Permet de suivre une requête à travers cloudflared puis nginx.
  it('reprend un identifiant amont bien formé', () => {
    const { req } = faireRequete('trace-abc-123');

    expect(req.id).toBe('trace-abc-123');
  });

  // L'en-tête vient du client et finit dans les logs : jeu de caractères borné.
  it.each([
    ['une injection de saut de ligne', 'abc\ninjecté'],
    ['un en-tête démesuré', 'a'.repeat(65)],
    ['des caractères hors du jeu autorisé', '<script>'],
    ['une valeur vide', ''],
  ])('ignore %s', (_cas, entete) => {
    const { req } = faireRequete(entete);

    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
