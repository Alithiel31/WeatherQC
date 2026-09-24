import { CITIES } from '../data/cities.js';
import { config } from '../config.js';
import { log } from '../lib/log.js';
import { fetchForecast } from './openmeteo.service.js';
import {
  detecterAlertes,
  redigerNotification,
  SEUILS_DEFAUT,
  type TypeAlerte,
} from './detecteur-alertes.js';
import {
  villesAbonnees,
  abonnementsParVille,
  dejaEnvoyee,
  marquerEnvoyee,
  effacerEnvoyee,
  supprimerAbonnement,
} from './abonnements.service.js';
import { envoyerNotification } from './notifications.service.js';

/**
 * Vérification périodique des alertes météo pour les villes abonnées, et
 * envoi Web Push aux abonnements concernés.
 *
 * Relie `detecteur-alertes.ts` (fonction pure) à `abonnements.service.ts`
 * (stockage) et `notifications.service.ts` (envoi). Le cycle de vie du
 * minuteur suit le même patron que `cache.service.ts` : démarré
 * explicitement par `app.ts`, jamais à l'import, pour que les tests restent
 * déterministes.
 */

const TOUS_LES_TYPES: TypeAlerte[] = [
  'precipitation',
  'chute-temperature',
  'vent',
  'verglas',
  'orage',
];

async function cyclerVille(villeId: string): Promise<void> {
  const ville = CITIES[villeId];
  if (!ville) {
    // Ne devrait pas arriver — un abonnement n'est créé que pour une ville de
    // CITIES (voir le contrôleur) — mais un cycle horaire ne doit jamais
    // planter sur une incohérence de données.
    log.warn('Ville abonnée absente de CITIES, ignorée au cycle de vérification', { villeId });
    return;
  }

  const previsions = await fetchForecast(ville);

  for (const abonnement of abonnementsParVille(villeId)) {
    // La détection dépend des seuils propres à cet abonnement — voir
    // `abonnements.service.ts#SeuilsPersonnalises` — donc par abonné plutôt
    // que mutualisée par ville, contrairement à `fetchForecast` ci-dessus qui
    // reste un seul appel réseau par ville.
    const alertes = detecterAlertes(
      { temperature: previsions.actuel.temperature, code: previsions.actuel.code },
      previsions.horaire,
      { ...SEUILS_DEFAUT, ...abonnement.seuils }
    );
    const typesActifs = new Set(alertes.map((a) => a.type));

    // Anti-spam : un type qui ne se vérifie plus libère l'abonné pour la
    // prochaine occurrence de la même situation.
    for (const type of TOUS_LES_TYPES) {
      if (!typesActifs.has(type)) effacerEnvoyee(abonnement.id, type);
    }

    for (const alerte of alertes) {
      if (dejaEnvoyee(abonnement.id, alerte.type)) continue;

      const resultat = await envoyerNotification(
        abonnement,
        redigerNotification(alerte, ville.nom)
      );

      if (resultat === 'expiree') {
        supprimerAbonnement(abonnement.endpoint);
        break; // endpoint révoqué : inutile de tenter les autres alertes pour lui
      }
      if (resultat === 'envoyee') {
        marquerEnvoyee(abonnement.id, alerte.type);
      }
      // 'echec' : on retentera ce même type au prochain cycle horaire, sans
      // marquer l'anti-spam — sinon un envoi raté ne serait jamais retenté.
    }
  }
}

/**
 * Un cycle complet, sur toutes les villes abonnées.
 *
 * Une ville en échec (Open-Meteo en panne, par exemple) ne doit pas empêcher
 * les autres d'être vérifiées — chacune est isolée dans son propre `try`.
 */
export async function cyclerAlertes(): Promise<void> {
  if (!config.vapid) return; // pas de clés VAPID : rien à envoyer

  for (const villeId of villesAbonnees()) {
    try {
      await cyclerVille(villeId);
    } catch (erreur) {
      log.error('Échec du cycle de vérification pour une ville', {
        villeId,
        message: erreur instanceof Error ? erreur.message : String(erreur),
      });
    }
  }
}

let minuteur: ReturnType<typeof setInterval> | null = null;

export function demarrerVerificateur(intervalMs = 60 * 60 * 1000): void {
  if (minuteur) return;
  minuteur = setInterval(() => {
    cyclerAlertes().catch((erreur) => {
      log.error('Échec du cycle de vérification des alertes', {
        message: erreur instanceof Error ? erreur.message : String(erreur),
      });
    });
  }, intervalMs);
  minuteur.unref?.();
}

export function arreterVerificateur(): void {
  if (!minuteur) return;
  clearInterval(minuteur);
  minuteur = null;
}
