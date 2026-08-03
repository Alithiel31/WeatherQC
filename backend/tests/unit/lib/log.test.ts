import { describe, it, expect, vi, afterEach } from 'vitest';
import { log } from '../../../src/lib/log.js';
import { config } from '../../../src/config.js';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Capture la dernière ligne écrite sur la console. */
function capturer(canal: 'log' | 'error') {
  return vi.spyOn(console, canal).mockImplementation(() => {});
}

describe('log', () => {
  it('écrit les erreurs sur console.error et le reste sur console.log', () => {
    const sortieErreur = capturer('error');
    const sortieStandard = capturer('log');

    log.error('boum');
    log.info('tout va bien');
    log.warn('attention');

    expect(sortieErreur).toHaveBeenCalledOnce();
    expect(sortieStandard).toHaveBeenCalledTimes(2);
  });

  it('horodate et nomme le niveau', () => {
    const sortie = capturer('log');

    log.info('démarrage');

    expect(sortie.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z \[info\] démarrage$/);
  });

  it('joint le contexte', () => {
    const sortie = capturer('log');

    log.info('requête', { requestId: 'abc', statut: 404 });

    expect(sortie.mock.calls[0][0]).toContain('{"requestId":"abc","statut":404}');
  });

  it('n’ajoute rien pour un contexte vide', () => {
    const sortie = capturer('log');

    log.info('nu', {});

    expect(sortie.mock.calls[0][0]).toMatch(/\[info\] nu$/);
  });

  // En production les logs sont collectés : une ligne = un objet JSON.
  it('écrit du JSON en production', () => {
    vi.spyOn(config, 'isProd', 'get').mockReturnValue(true);
    const sortie = capturer('log');

    log.info('démarrage', { port: 3005 });

    const ligne = JSON.parse(sortie.mock.calls[0][0] as string);
    expect(ligne).toMatchObject({ niveau: 'info', message: 'démarrage', port: 3005 });
    expect(ligne.horodatage).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
