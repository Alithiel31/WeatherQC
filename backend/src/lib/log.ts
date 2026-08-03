import { config } from '../config.js';

/**
 * Journalisation minimale : niveau, horodatage, et contexte arbitraire.
 *
 * Les `console.log` d'origine n'avaient ni horodatage ni corrélation — relier un
 * 502 signalé par un utilisateur à sa ligne de log relevait de la fouille.
 *
 * En production le format est JSON, lisible par `docker compose logs` comme par
 * un collecteur ; en développement, une ligne compacte. Sans dépendance : pino
 * ou winston seraient surdimensionnés pour trois routes.
 */

type Niveau = 'info' | 'warn' | 'error';

type Contexte = Record<string, unknown>;

function ecrire(niveau: Niveau, message: string, contexte?: Contexte): void {
  const horodatage = new Date().toISOString();
  const sortie = niveau === 'error' ? console.error : console.log;

  if (config.isProd) {
    sortie(JSON.stringify({ horodatage, niveau, message, ...contexte }));
    return;
  }

  const suffixe = contexte && Object.keys(contexte).length ? ` ${JSON.stringify(contexte)}` : '';
  sortie(`${horodatage} [${niveau}] ${message}${suffixe}`);
}

export const log = {
  info: (message: string, contexte?: Contexte) => ecrire('info', message, contexte),
  warn: (message: string, contexte?: Contexte) => ecrire('warn', message, contexte),
  error: (message: string, contexte?: Contexte) => ecrire('error', message, contexte),
};
