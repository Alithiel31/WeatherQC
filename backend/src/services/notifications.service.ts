import webpush, { WebPushError } from 'web-push';
import { config } from '../config.js';
import { log } from '../lib/log.js';
import type { Abonnement } from './abonnements.service.js';
import type { Notification } from './detecteur-alertes.js';

/**
 * Enveloppe autour de `web-push` — la seule dépendance qui parle réellement
 * au protocole Web Push (chiffrement, en-têtes VAPID). Ce module ne connaît
 * ni la base des abonnements ni le détecteur d'alertes : il sait juste
 * envoyer une notification à un endpoint donné, et dire ce qui s'est passé.
 */

export type ResultatEnvoi = 'envoyee' | 'expiree' | 'echec';

// Les notifications partent une à une dans `verificateur-alertes.ts` : un hôte
// qui ne répond pas bloquerait toutes celles qui suivent. Deux garde-fous :
// - l'inactivité du socket, appliquée par `web-push` qui détruit alors la requête ;
// - une durée totale, au cas où le socket resterait actif sans jamais conclure.
const DELAI_ENVOI_MS = 10_000;
const DELAI_MAX_ENVOI_MS = 15_000;

/**
 * Libère l'appelant après `ms` quoi qu'il arrive. La requête abandonnée n'est
 * pas fermée par ce plafond : elle l'est par le délai d'inactivité ci-dessus.
 */
function avecPlafond<T>(promesse: Promise<T>, ms: number): Promise<T> {
  let minuteur: NodeJS.Timeout | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error(`Délai d'envoi dépassé (${ms} ms)`)), ms);
  });
  return Promise.race([promesse, delai]).finally(() => clearTimeout(minuteur));
}

// L'endpoint complet identifie un appareil abonné : on ne journalise que
// l'hôte, suffisant pour distinguer FCM, Mozilla, Windows ou Apple.
function hoteDe(endpoint: string): string {
  try {
    return new URL(endpoint).hostname;
  } catch {
    return 'invalide';
  }
}

/**
 * Envoie une notification à un abonnement. Ne lève jamais : le vérificateur
 * traite plusieurs abonnements par cycle, l'échec de l'un ne doit pas
 * interrompre les suivants — voir `verificateur-alertes.ts`.
 */
export async function envoyerNotification(
  abonnement: Pick<Abonnement, 'endpoint' | 'p256dh' | 'auth'>,
  notification: Notification
): Promise<ResultatEnvoi> {
  if (!config.vapid) {
    log.error('Envoi de notification tenté sans clés VAPID configurées.');
    return 'echec';
  }

  // Appelé à chaque envoi plutôt que mis en cache : `sendNotification` ne
  // fait que lire ces valeurs, et ça évite un état de module à réinitialiser
  // entre les tests qui font varier `config.vapid`.
  webpush.setVapidDetails(config.vapid.contact, config.vapid.publicKey, config.vapid.privateKey);

  try {
    await avecPlafond(
      webpush.sendNotification(
        {
          endpoint: abonnement.endpoint,
          keys: { p256dh: abonnement.p256dh, auth: abonnement.auth },
        },
        JSON.stringify(notification),
        { timeout: DELAI_ENVOI_MS }
      ),
      DELAI_MAX_ENVOI_MS
    );
    return 'envoyee';
  } catch (erreur) {
    // 404/410 : le navigateur a révoqué l'abonnement (désinstallation,
    // changement d'appareil, permission retirée) — à nettoyer, pas une panne
    // à journaliser comme telle.
    if (
      erreur instanceof WebPushError &&
      (erreur.statusCode === 404 || erreur.statusCode === 410)
    ) {
      log.warn('Abonnement push expiré', {
        hote: hoteDe(abonnement.endpoint),
        statut: erreur.statusCode,
      });
      return 'expiree';
    }

    log.error("Échec d'envoi d'une notification push", {
      hote: hoteDe(abonnement.endpoint),
      statut: erreur instanceof WebPushError ? erreur.statusCode : undefined,
      message: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return 'echec';
  }
}
