import { ErreurApi, messageErreur } from './api.ts';
import { lireTexte, ecrire, supprimer } from './stockage.ts';
import type { SeuilsAlerte } from './types.ts';

/**
 * Levée quand l'utilisateur refuse la permission de notification. Distincte
 * d'`ErreurApi` — le backend n'est pour rien dans ce refus — pour qu'
 * `AlertesMeteo.svelte` puisse afficher un message adapté plutôt que le
 * message générique d'une panne serveur.
 */
export class PermissionRefuseeError extends Error {}

const CLE_VILLE_ABONNEE = 'villeAbonnee';

/**
 * Support natif requis pour les notifications push — absent de Safari iOS
 * < 16.4 et de la navigation privée sur plusieurs navigateurs. Le contrôle se
 * masque entièrement dans ce cas plutôt que d'afficher une erreur : voir
 * `AlertesMeteo.svelte`.
 */
export function supportePush(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Ville pour laquelle ce navigateur porte un abonnement push actif, ou `null`.
 *
 * Un navigateur ne porte qu'un abonnement actif à la fois pour cette origine
 * (voir `abonnements.service.ts`) : la ville mémorisée localement ne fait donc
 * sens que si un abonnement existe réellement encore côté navigateur. Une
 * incohérence — abonnement révoqué ailleurs, stockage du site vidé en partie —
 * efface la mémorisation plutôt que d'afficher un état qui ment.
 */
export async function villeAbonnee(): Promise<string | null> {
  const memorisee = lireTexte(CLE_VILLE_ABONNEE, '');
  if (!memorisee) return null;

  const inscription = await navigator.serviceWorker.ready;
  const abonnement = await inscription.pushManager.getSubscription();
  if (!abonnement) {
    supprimer(CLE_VILLE_ABONNEE);
    return null;
  }
  return memorisee;
}

/**
 * `applicationServerKey` attend un `BufferSource` adossé à un `ArrayBuffer` —
 * pas au `ArrayBufferLike` que renvoie `Uint8Array.from()` sous TypeScript
 * récent — d'où l'allocation explicite plutôt qu'un simple `.from()`. La clé
 * VAPID voyage en base64 URL-safe.
 */
function cleVapidVersUint8Array(cle: string): Uint8Array<ArrayBuffer> {
  const remplissage = '='.repeat((4 - (cle.length % 4)) % 4);
  const base64 = (cle + remplissage).replace(/-/g, '+').replace(/_/g, '/');
  const brut = atob(base64);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

async function recupererClePublique(): Promise<string> {
  const res = await fetch('/api/notifications/cle-publique');
  if (!res.ok) {
    throw new ErreurApi(await messageErreur(res, 'Notifications indisponibles pour le moment.'));
  }
  const corps = (await res.json()) as { clePublique: string };
  return corps.clePublique;
}

/**
 * Demande la permission, s'abonne via `PushManager` et poste l'abonnement au
 * backend pour `ville`. Un abonnement existant pour une autre ville est
 * remplacé — le navigateur n'en porte qu'un à la fois pour cette origine.
 *
 * `seuils` omis (plutôt que `{}`) quand l'abonné n'a rien personnalisé : le
 * backend applique alors ses propres valeurs par défaut.
 */
export async function abonner(ville: string, seuils?: SeuilsAlerte): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new PermissionRefuseeError('Permission de notification refusée.');
  }

  const inscription = await navigator.serviceWorker.ready;
  const clePublique = await recupererClePublique();
  const abonnement = await inscription.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: cleVapidVersUint8Array(clePublique),
  });

  try {
    const res = await fetch('/api/notifications/abonnement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ville, subscription: abonnement.toJSON(), ...(seuils && { seuils }) }),
    });
    if (!res.ok) {
      throw new ErreurApi(await messageErreur(res, 'Abonnement refusé par le serveur.'));
    }
  } catch (e) {
    // Le backend n'a pas enregistré l'abonnement : un abonnement navigateur
    // orphelin ne servirait à rien et masquerait l'échec à un nouvel essai.
    await abonnement.unsubscribe();
    throw e;
  }

  ecrire(CLE_VILLE_ABONNEE, ville);
}

/** Désabonne le navigateur — sans effet si aucun abonnement n'est actif. */
export async function desabonner(): Promise<void> {
  const inscription = await navigator.serviceWorker.ready;
  const abonnement = await inscription.pushManager.getSubscription();
  if (!abonnement) {
    supprimer(CLE_VILLE_ABONNEE);
    return;
  }

  const res = await fetch('/api/notifications/abonnement', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: abonnement.endpoint }),
  });
  if (!res.ok) {
    throw new ErreurApi(await messageErreur(res, 'Désabonnement refusé par le serveur.'));
  }

  await abonnement.unsubscribe();
  supprimer(CLE_VILLE_ABONNEE);
}
