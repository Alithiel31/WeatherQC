import { config } from '../config.js';
import { ServiceIndisponibleError } from './errors.js';
import { log } from './log.js';

/**
 * Disjoncteur par service amont.
 *
 * Un amont mort coûtait cher : deux tentatives plus une pause de 300 ms, soit
 * une connexion tenue ~10 s par requête. Les quotas étant par IP cliente, N
 * visiteurs multipliaient librement ce coût — et sur un Raspberry Pi borné à
 * 256 Mo, une panne chez un tiers devenait un épuisement local.
 *
 * Passé un nombre d'échecs consécutifs, on cesse d'appeler pendant un temps de
 * repos : l'échec est immédiat, et le cache périmé prend le relais. Une seule
 * requête est laissée passer ensuite pour tester le retour du service.
 */

type Etat = 'ferme' | 'ouvert' | 'demi-ouvert';

interface Disjoncteur {
  etat: Etat;
  echecsConsecutifs: number;
  reouvertureA: number;
  /** Vrai quand la requête de test est déjà partie, pour n'en laisser qu'une. */
  testEnCours: boolean;
}

const disjoncteurs = new Map<string, Disjoncteur>();

function obtenir(service: string): Disjoncteur {
  let d = disjoncteurs.get(service);
  if (!d) {
    d = { etat: 'ferme', echecsConsecutifs: 0, reouvertureA: 0, testEnCours: false };
    disjoncteurs.set(service, d);
  }
  return d;
}

/** Levée quand le disjoncteur refuse l'appel — jamais une erreur de l'amont. */
export class CircuitOuvertError extends ServiceIndisponibleError {
  constructor(service: string) {
    super(`${service} est en panne répétée : appels suspendus, réessayez sous peu.`);
  }
}

/**
 * Autorise ou non un appel. À interroger avant de partir sur le réseau.
 *
 * Un passage `ouvert` → `demi-ouvert` consomme le droit d'essai : les autres
 * appelants restent refusés tant que le test n'a pas rendu son verdict.
 */
export function autoriserAppel(service: string): boolean {
  const d = obtenir(service);

  if (d.etat === 'ferme') return true;

  if (d.etat === 'ouvert') {
    if (Date.now() < d.reouvertureA) return false;
    d.etat = 'demi-ouvert';
    d.testEnCours = true;
    log.info('Disjoncteur en test', { service });
    return true;
  }

  // Demi-ouvert : une seule requête de test à la fois.
  if (d.testEnCours) return false;
  d.testEnCours = true;
  return true;
}

export function signalerSucces(service: string): void {
  const d = obtenir(service);
  if (d.etat !== 'ferme') log.info('Disjoncteur refermé', { service });
  d.etat = 'ferme';
  d.echecsConsecutifs = 0;
  d.testEnCours = false;
}

export function signalerEchec(service: string): void {
  const d = obtenir(service);
  d.echecsConsecutifs++;
  d.testEnCours = false;

  // Un échec en demi-ouvert rouvre immédiatement : le service n'est pas revenu.
  const doitOuvrir = d.etat === 'demi-ouvert' || d.echecsConsecutifs >= config.breaker.seuilEchecs;

  if (doitOuvrir && d.etat !== 'ouvert') {
    log.warn('Disjoncteur ouvert', { service, echecsConsecutifs: d.echecsConsecutifs });
  }
  if (doitOuvrir) {
    d.etat = 'ouvert';
    d.reouvertureA = Date.now() + config.breaker.reposMs;
  }
}

/** État courant de chaque service, exposé par `/api/sante`. */
export function etatDisjoncteurs(): Record<string, { etat: Etat; echecsConsecutifs: number }> {
  const instantane: Record<string, { etat: Etat; echecsConsecutifs: number }> = {};
  for (const [service, d] of disjoncteurs) {
    instantane[service] = { etat: d.etat, echecsConsecutifs: d.echecsConsecutifs };
  }
  return instantane;
}

/** Remet tout à zéro — isolation des tests. */
export function reinitialiserDisjoncteurs(): void {
  disjoncteurs.clear();
}
