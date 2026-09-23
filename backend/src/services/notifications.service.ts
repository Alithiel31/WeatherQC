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
    await webpush.sendNotification(
      { endpoint: abonnement.endpoint, keys: { p256dh: abonnement.p256dh, auth: abonnement.auth } },
      JSON.stringify(notification)
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
        endpoint: abonnement.endpoint,
        statut: erreur.statusCode,
      });
      return 'expiree';
    }

    log.error("Échec d'envoi d'une notification push", {
      endpoint: abonnement.endpoint,
      statut: erreur instanceof WebPushError ? erreur.statusCode : undefined,
      message: erreur instanceof Error ? erreur.message : String(erreur),
    });
    return 'echec';
  }
}
