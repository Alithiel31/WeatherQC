import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Previsions } from '../../../src/services/openmeteo.service.js';

// `abonnements.service` et `detecteur-alertes` restent réels — ce sont des
// modules d'état/logique pure déjà testés ailleurs, et les faire tourner ici
// vérifie l'orchestration bout en bout. Seuls les modules qui parleraient au
// réseau (Open-Meteo, Web Push) sont mockés.
vi.mock('../../../src/services/openmeteo.service.js', () => ({
  fetchForecast: vi.fn(),
}));
vi.mock('../../../src/services/notifications.service.js', () => ({
  envoyerNotification: vi.fn(),
}));

import { fetchForecast } from '../../../src/services/openmeteo.service.js';
import { envoyerNotification } from '../../../src/services/notifications.service.js';
import { config } from '../../../src/config.js';
import {
  ajouterAbonnement,
  abonnementsParVille,
  dejaEnvoyee,
  marquerEnvoyee,
} from '../../../src/services/abonnements.service.js';
import {
  cyclerAlertes,
  demarrerVerificateur,
  arreterVerificateur,
} from '../../../src/services/verificateur-alertes.js';

const VAPID_TEST = {
  publicKey: 'clé-publique-test',
  privateKey: 'clé-privée-test',
  contact: 'mailto:test@exemple.com',
};

/** 6 heures calmes — aucun seuil de `SEUILS_DEFAUT` n'est franchi. */
function previsionsSansAlerte(): Previsions {
  return {
    misAJour: '2026-09-23T10:00',
    actuel: { temperature: 15, ressenti: 15, humidite: 50, vent: 10, code: 0, jour: true },
    horaire: Array.from({ length: 6 }, (_, i) => ({
      heure: `2026-09-23T${String(11 + i).padStart(2, '0')}:00`,
      temperature: 15,
      code: 0,
      precipitation: 0,
      rafales: 10,
    })),
    quotidien: [],
  };
}

/** Mêmes prévisions, avec des rafales dès la première heure : déclenche l'alerte "vent". */
function previsionsAvecVent(): Previsions {
  const p = previsionsSansAlerte();
  p.horaire[0].rafales = 80;
  return p;
}

describe('verificateur-alertes', () => {
  const vapidOriginal = config.vapid;

  beforeEach(() => {
    config.vapid = VAPID_TEST;
    vi.mocked(fetchForecast).mockReset();
    vi.mocked(envoyerNotification).mockReset();
  });

  afterEach(() => {
    config.vapid = vapidOriginal;
  });

  it('ne fait rien sans clés VAPID configurées', async () => {
    config.vapid = null;
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p', auth: 'a' });

    await cyclerAlertes();

    expect(fetchForecast).not.toHaveBeenCalled();
  });

  it("n'appelle Open-Meteo pour aucune ville sans abonnement", async () => {
    await cyclerAlertes();

    expect(fetchForecast).not.toHaveBeenCalled();
  });

  it("envoie une notification pour une alerte nouvelle et marque l'anti-spam", async () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p', auth: 'a' });
    const [abonnement] = abonnementsParVille('montreal');
    vi.mocked(fetchForecast).mockResolvedValue(previsionsAvecVent());
    vi.mocked(envoyerNotification).mockResolvedValue('envoyee');

    await cyclerAlertes();

    expect(envoyerNotification).toHaveBeenCalledTimes(1);
    expect(envoyerNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://push/1' }),
      expect.objectContaining({ titre: expect.stringContaining('Vents forts') })
    );
    expect(dejaEnvoyee(abonnement.id, 'vent')).toBe(true);
  });

  it('ne renvoie pas une alerte déjà notifiée au cycle précédent', async () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p', auth: 'a' });
    const [abonnement] = abonnementsParVille('montreal');
    marquerEnvoyee(abonnement.id, 'vent');
    vi.mocked(fetchForecast).mockResolvedValue(previsionsAvecVent());

    await cyclerAlertes();

    expect(envoyerNotification).not.toHaveBeenCalled();
  });

  it("efface l'anti-spam d'un type qui ne se vérifie plus", async () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p', auth: 'a' });
    const [abonnement] = abonnementsParVille('montreal');
    marquerEnvoyee(abonnement.id, 'vent');
    vi.mocked(fetchForecast).mockResolvedValue(previsionsSansAlerte());

    await cyclerAlertes();

    expect(dejaEnvoyee(abonnement.id, 'vent')).toBe(false);
  });

  it('supprime un abonnement dont le endpoint a expiré (410)', async () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p', auth: 'a' });
    vi.mocked(fetchForecast).mockResolvedValue(previsionsAvecVent());
    vi.mocked(envoyerNotification).mockResolvedValue('expiree');

    await cyclerAlertes();

    expect(abonnementsParVille('montreal')).toEqual([]);
  });

  it("ne marque pas l'anti-spam et ne désabonne pas sur un échec d'envoi", async () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p', auth: 'a' });
    const [abonnement] = abonnementsParVille('montreal');
    vi.mocked(fetchForecast).mockResolvedValue(previsionsAvecVent());
    vi.mocked(envoyerNotification).mockResolvedValue('echec');

    await cyclerAlertes();

    expect(dejaEnvoyee(abonnement.id, 'vent')).toBe(false);
    expect(abonnementsParVille('montreal')).toHaveLength(1);
  });

  it('continue les autres villes si une ville échoue (Open-Meteo en panne)', async () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p', auth: 'a' });
    ajouterAbonnement({ ville: 'quebec', endpoint: 'https://push/2', p256dh: 'p', auth: 'a' });
    vi.mocked(fetchForecast).mockImplementation(async (params) => {
      if (params.latitude === 45.5019) throw new Error('Open-Meteo indisponible');
      return previsionsAvecVent();
    });
    vi.mocked(envoyerNotification).mockResolvedValue('envoyee');

    await expect(cyclerAlertes()).resolves.not.toThrow();

    expect(envoyerNotification).toHaveBeenCalledTimes(1);
  });

  it('ignore une ville abonnée absente de CITIES, sans planter', async () => {
    ajouterAbonnement({ ville: 'nulle-part', endpoint: 'https://push/1', p256dh: 'p', auth: 'a' });

    await expect(cyclerAlertes()).resolves.not.toThrow();

    expect(fetchForecast).not.toHaveBeenCalled();
  });

  describe('demarrerVerificateur / arreterVerificateur', () => {
    afterEach(() => {
      arreterVerificateur();
    });

    it('déclenche un cycle à intervalle régulier', async () => {
      ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p', auth: 'a' });
      vi.mocked(fetchForecast).mockResolvedValue(previsionsSansAlerte());

      demarrerVerificateur(20);
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(fetchForecast).toHaveBeenCalled();
    });

    it('est idempotent, et arreterVerificateur() peut être appelé plusieurs fois sans lever', () => {
      demarrerVerificateur(1000);
      demarrerVerificateur(1000);
      arreterVerificateur();

      expect(() => arreterVerificateur()).not.toThrow();
    });
  });
});
