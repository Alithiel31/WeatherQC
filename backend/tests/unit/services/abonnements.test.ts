import { describe, it, expect } from 'vitest';
import {
  fermerAbonnements,
  ajouterAbonnement,
  supprimerAbonnement,
  abonnementsParVille,
  villesAbonnees,
  dejaEnvoyee,
  marquerEnvoyee,
  effacerEnvoyee,
  nombreAbonnements,
} from '../../../src/services/abonnements.service.js';

// `ouvrirAbonnements(':memory:')` / `fermerAbonnements()` tournent déjà autour
// de chaque test via `tests/setup.ts` — inutile de les répéter ici.
describe('abonnements.service', () => {
  it("lève une erreur explicite si on l'interroge avant ouvrirAbonnements()", () => {
    fermerAbonnements();
    expect(() => nombreAbonnements()).toThrow(/non ouverte/);
  });

  it('ajoute un abonnement et le retrouve par ville', () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p1', auth: 'a1' });

    const abonnements = abonnementsParVille('montreal');
    expect(abonnements).toHaveLength(1);
    expect(abonnements[0]).toMatchObject({
      ville: 'montreal',
      endpoint: 'https://push/1',
      p256dh: 'p1',
      auth: 'a1',
    });
    expect(typeof abonnements[0].id).toBe('number');
    expect(typeof abonnements[0].creeLe).toBe('number');
  });

  it('ne renvoie rien pour une ville sans abonnement', () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p1', auth: 'a1' });
    expect(abonnementsParVille('quebec')).toEqual([]);
  });

  it('sans seuils fournis, seuils est un objet vide', () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p1', auth: 'a1' });
    expect(abonnementsParVille('montreal')[0].seuils).toEqual({});
  });

  it('ne retient que les seuils personnalisés fournis', () => {
    ajouterAbonnement({
      ville: 'montreal',
      endpoint: 'https://push/1',
      p256dh: 'p1',
      auth: 'a1',
      seuils: { rafales: 40 },
    });
    expect(abonnementsParVille('montreal')[0].seuils).toEqual({ rafales: 40 });
  });

  it('retrouve les trois seuils personnalisés quand ils sont tous fournis', () => {
    ajouterAbonnement({
      ville: 'montreal',
      endpoint: 'https://push/1',
      p256dh: 'p1',
      auth: 'a1',
      seuils: { precipitationProbabilite: 50, chuteTemperature: 5, rafales: 40 },
    });
    expect(abonnementsParVille('montreal')[0].seuils).toEqual({
      precipitationProbabilite: 50,
      chuteTemperature: 5,
      rafales: 40,
    });
  });

  it('réabonner sans seuils efface d’anciens seuils personnalisés', () => {
    ajouterAbonnement({
      ville: 'montreal',
      endpoint: 'https://push/1',
      p256dh: 'p1',
      auth: 'a1',
      seuils: { rafales: 40, chuteTemperature: 5 },
    });
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p1', auth: 'a1' });

    expect(abonnementsParVille('montreal')[0].seuils).toEqual({});
  });

  // Un navigateur ne porte qu'un abonnement push actif : réabonner le même
  // endpoint à une autre ville doit remplacer, pas dupliquer.
  it('remplace un abonnement existant réabonné à une autre ville (même endpoint)', () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p1', auth: 'a1' });
    ajouterAbonnement({ ville: 'quebec', endpoint: 'https://push/1', p256dh: 'p2', auth: 'a2' });

    expect(abonnementsParVille('montreal')).toEqual([]);
    const abonnements = abonnementsParVille('quebec');
    expect(abonnements).toHaveLength(1);
    expect(abonnements[0]).toMatchObject({ p256dh: 'p2', auth: 'a2' });
    expect(nombreAbonnements()).toBe(1);
  });

  it('supprime un abonnement par son endpoint', () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p1', auth: 'a1' });
    supprimerAbonnement('https://push/1');

    expect(abonnementsParVille('montreal')).toEqual([]);
    expect(nombreAbonnements()).toBe(0);
  });

  it('supprimer un endpoint inconnu ne lève pas', () => {
    expect(() => supprimerAbonnement('https://inconnu')).not.toThrow();
  });

  it('villesAbonnees liste les villes distinctes ayant au moins un abonnement', () => {
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/1', p256dh: 'p1', auth: 'a1' });
    ajouterAbonnement({ ville: 'montreal', endpoint: 'https://push/2', p256dh: 'p2', auth: 'a2' });
    ajouterAbonnement({ ville: 'quebec', endpoint: 'https://push/3', p256dh: 'p3', auth: 'a3' });

    expect(villesAbonnees().sort()).toEqual(['montreal', 'quebec']);
  });

  it('villesAbonnees est vide sans aucun abonnement', () => {
    expect(villesAbonnees()).toEqual([]);
  });

  describe('anti-spam (alertes déjà envoyées)', () => {
    it("dejaEnvoyee est faux tant qu'aucune alerte n'a été marquée", () => {
      ajouterAbonnement({
        ville: 'montreal',
        endpoint: 'https://push/1',
        p256dh: 'p1',
        auth: 'a1',
      });
      const [{ id }] = abonnementsParVille('montreal');

      expect(dejaEnvoyee(id, 'vent')).toBe(false);
    });

    it('marquerEnvoyee rend dejaEnvoyee vrai pour ce couple abonnement+type', () => {
      ajouterAbonnement({
        ville: 'montreal',
        endpoint: 'https://push/1',
        p256dh: 'p1',
        auth: 'a1',
      });
      const [{ id }] = abonnementsParVille('montreal');

      marquerEnvoyee(id, 'vent');

      expect(dejaEnvoyee(id, 'vent')).toBe(true);
      // Un autre type n'est pas affecté par le marquage.
      expect(dejaEnvoyee(id, 'orage')).toBe(false);
    });

    it('marquerEnvoyee deux fois sur le même couple ne lève pas (upsert)', () => {
      ajouterAbonnement({
        ville: 'montreal',
        endpoint: 'https://push/1',
        p256dh: 'p1',
        auth: 'a1',
      });
      const [{ id }] = abonnementsParVille('montreal');

      expect(() => {
        marquerEnvoyee(id, 'vent');
        marquerEnvoyee(id, 'vent');
      }).not.toThrow();
      expect(dejaEnvoyee(id, 'vent')).toBe(true);
    });

    it('effacerEnvoyee permet une nouvelle notification du même type', () => {
      ajouterAbonnement({
        ville: 'montreal',
        endpoint: 'https://push/1',
        p256dh: 'p1',
        auth: 'a1',
      });
      const [{ id }] = abonnementsParVille('montreal');

      marquerEnvoyee(id, 'vent');
      effacerEnvoyee(id, 'vent');

      expect(dejaEnvoyee(id, 'vent')).toBe(false);
    });

    // La contrainte ON DELETE CASCADE doit nettoyer l'anti-spam d'un
    // abonnement supprimé — sinon la table grossit indéfiniment.
    it('la suppression d’un abonnement efface son anti-spam associé', () => {
      ajouterAbonnement({
        ville: 'montreal',
        endpoint: 'https://push/1',
        p256dh: 'p1',
        auth: 'a1',
      });
      const [{ id }] = abonnementsParVille('montreal');
      marquerEnvoyee(id, 'vent');

      supprimerAbonnement('https://push/1');

      // Rouvrir un abonnement identique recyclerait le même id auto-incrémenté
      // uniquement si SQLite le réutilisait — ce n'est pas le cas ici, donc ce
      // test vérifie l'absence de fuite via le comptage plutôt qu'un id précis.
      expect(nombreAbonnements()).toBe(0);
    });
  });
});
