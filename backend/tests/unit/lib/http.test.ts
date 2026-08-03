import { describe, it, expect, vi } from 'vitest';
import { fetchAvecTimeout } from '../../../src/lib/http.js';
import { BadGatewayError, GatewayTimeoutError } from '../../../src/lib/errors.js';

/** Erreur telle que la produit `AbortSignal.timeout()`. */
function erreurTimeout(): Error {
  const erreur = new Error('The operation was aborted due to timeout');
  erreur.name = 'TimeoutError';
  return erreur;
}

describe('fetchAvecTimeout', () => {
  describe('Délai maximal', () => {
    it('passe un signal de timeout à fetch', async () => {
      const mock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
      vi.stubGlobal('fetch', mock);

      await fetchAvecTimeout('https://exemple.test', { service: 'Exemple' });

      expect(mock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it('lève GatewayTimeoutError si le délai est dépassé', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(erreurTimeout()));

      await expect(
        fetchAvecTimeout('https://exemple.test', { service: 'Exemple', timeoutMs: 20 })
      ).rejects.toThrow(GatewayTimeoutError);
    });

    it('mentionne le service et le délai dans le message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(erreurTimeout()));

      await expect(
        fetchAvecTimeout('https://exemple.test', { service: 'Open-Meteo', timeoutMs: 20 })
      ).rejects.toThrow(/Open-Meteo.*20 ms/);
    });
  });

  describe('Nouvelle tentative', () => {
    it('rejoue une fois sur erreur réseau', async () => {
      const mock = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({ ok: true, status: 200 });
      vi.stubGlobal('fetch', mock);

      const reponse = await fetchAvecTimeout('https://exemple.test', { service: 'Exemple' });

      expect(reponse.status).toBe(200);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it('rejoue une fois sur 5xx', async () => {
      const mock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: true, status: 200 });
      vi.stubGlobal('fetch', mock);

      const reponse = await fetchAvecTimeout('https://exemple.test', { service: 'Exemple' });

      expect(reponse.status).toBe(200);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it('ne rejoue pas sur 4xx — une réponse 404 est légitime', async () => {
      const mock = vi.fn().mockResolvedValue({ ok: false, status: 404 });
      vi.stubGlobal('fetch', mock);

      const reponse = await fetchAvecTimeout('https://exemple.test', { service: 'Exemple' });

      expect(reponse.status).toBe(404);
      expect(mock).toHaveBeenCalledTimes(1);
    });

    it('retourne le dernier 5xx quand toutes les tentatives échouent', async () => {
      const mock = vi.fn().mockResolvedValue({ ok: false, status: 502 });
      vi.stubGlobal('fetch', mock);

      const reponse = await fetchAvecTimeout('https://exemple.test', { service: 'Exemple' });

      expect(reponse.status).toBe(502);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it('lève BadGatewayError après épuisement des tentatives réseau', async () => {
      const mock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      vi.stubGlobal('fetch', mock);

      await expect(
        fetchAvecTimeout('https://exemple.test', { service: 'Exemple' })
      ).rejects.toThrow(BadGatewayError);
      expect(mock).toHaveBeenCalledTimes(2);
    });

    it('décrit lisiblement un rejet qui n’est pas une Error', async () => {
      // `fetch` peut rejeter une valeur brute : sans la conversion explicite,
      // le message d'erreur ressortirait en « [object Object] ».
      const mock = vi.fn().mockRejectedValue('connexion coupée');
      vi.stubGlobal('fetch', mock);

      await expect(
        fetchAvecTimeout('https://exemple.test', { service: 'Exemple' })
      ).rejects.toThrow('connexion coupée');
    });

    it('respecte un nombre de tentatives explicite', async () => {
      const mock = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      vi.stubGlobal('fetch', mock);

      await expect(
        fetchAvecTimeout('https://exemple.test', { service: 'Exemple', tentatives: 1 })
      ).rejects.toThrow(BadGatewayError);
      expect(mock).toHaveBeenCalledTimes(1);
    });
  });
});
