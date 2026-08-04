import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { journalAcces } from '../../../src/middlewares/acces.js';
import { log } from '../../../src/lib/log.js';

/**
 * Une requête réussie ne produisait aucune ligne : impossible de dire si la
 * lenteur venait d'Open-Meteo ou du Raspberry Pi, ni de voir un seul 429 — les
 * rejets du limiteur n'atteignent jamais le gestionnaire d'erreurs.
 */
function requete(overrides: Partial<Request> = {}): Request {
  return {
    id: 'req-1',
    method: 'GET',
    originalUrl: '/api/previsions/montreal',
    ...overrides,
  } as Request;
}

function reponse(statusCode: number): Response & EventEmitter {
  const res = new EventEmitter() as Response & EventEmitter;
  res.statusCode = statusCode;
  return res;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('journalAcces', () => {
  it('journalise une requête réussie avec sa durée', () => {
    const info = vi.spyOn(log, 'info').mockImplementation(() => {});
    const res = reponse(200);

    journalAcces(requete(), res, vi.fn());
    res.emit('finish');

    expect(info).toHaveBeenCalledWith(
      'Requête terminée',
      expect.objectContaining({
        requestId: 'req-1',
        methode: 'GET',
        chemin: '/api/previsions/montreal',
        statut: 200,
        dureeMs: expect.any(Number),
      })
    );
  });

  it('n’écrit rien avant la fin de la réponse', () => {
    const info = vi.spyOn(log, 'info').mockImplementation(() => {});

    journalAcces(requete(), reponse(200), vi.fn());

    expect(info).not.toHaveBeenCalled();
  });

  it('appelle bien le middleware suivant', () => {
    vi.spyOn(log, 'info').mockImplementation(() => {});
    const next = vi.fn();

    journalAcces(requete(), reponse(200), next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('monte un 429 en avertissement', () => {
    const warn = vi.spyOn(log, 'warn').mockImplementation(() => {});
    const res = reponse(429);

    journalAcces(requete(), res, vi.fn());
    res.emit('finish');

    // Les rejets du limiteur étaient les seuls totalement invisibles.
    expect(warn).toHaveBeenCalledWith('Requête terminée', expect.objectContaining({ statut: 429 }));
  });

  it('monte un 5xx en erreur', () => {
    const error = vi.spyOn(log, 'error').mockImplementation(() => {});
    const res = reponse(502);

    journalAcces(requete(), res, vi.fn());
    res.emit('finish');

    expect(error).toHaveBeenCalledWith(
      'Requête terminée',
      expect.objectContaining({ statut: 502 })
    );
  });

  it('reporte l’origine de la réponse quand le contrôleur la renseigne', () => {
    const info = vi.spyOn(log, 'info').mockImplementation(() => {});
    const res = reponse(200);
    res.origineCache = 'obsolete';

    journalAcces(requete(), res, vi.fn());
    res.emit('finish');

    expect(info).toHaveBeenCalledWith(
      'Requête terminée',
      expect.objectContaining({ cache: 'obsolete' })
    );
  });

  it('tronque une URL démesurée', () => {
    const info = vi.spyOn(log, 'info').mockImplementation(() => {});
    const res = reponse(404);
    vi.spyOn(log, 'warn').mockImplementation(() => {});

    // La chaîne de requête vient du client : les logs n'ont pas à absorber 8 ko.
    journalAcces(requete({ originalUrl: `/api/x?q=${'a'.repeat(5000)}` }), res, vi.fn());
    res.emit('finish');

    const contexte = (log.warn as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as {
      chemin: string;
    };
    expect(contexte.chemin.length).toBe(200);
    expect(info).not.toHaveBeenCalled();
  });
});
