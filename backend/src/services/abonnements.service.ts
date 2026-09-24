import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Seuils } from './detecteur-alertes.js';

/**
 * Stockage des abonnements aux alertes météo et de l'anti-spam associé.
 *
 * `node:sqlite` plutôt que `better-sqlite3` : module natif de Node, aucune
 * compilation à ajouter à l'image Alpine du backend. Le cycle de vie suit le
 * même patron que `cache.service.ts` — état de module, ouvert/fermé
 * explicitement par `app.ts`, jamais à l'import — pour que les tests gardent
 * la main sur une base `:memory:` isolée, sans timer ni fichier en arrière-plan.
 */

/** Sous-ensemble de `Seuils` qu'un abonné peut personnaliser — voir `detecteur-alertes.ts`. */
export type SeuilsPersonnalises = Partial<
  Pick<Seuils, 'precipitationProbabilite' | 'chuteTemperature' | 'rafales'>
>;

export interface Abonnement {
  id: number;
  ville: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  creeLe: number;
  /** Toujours présent, `{}` si l'abonné n'a rien personnalisé. */
  seuils: SeuilsPersonnalises;
}

export interface NouvelAbonnement {
  ville: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  seuils?: SeuilsPersonnalises;
}

let db: DatabaseSync | null = null;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS abonnements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ville TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    cree_le INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_abonnements_ville ON abonnements(ville);

  CREATE TABLE IF NOT EXISTS alertes_envoyees (
    abonnement_id INTEGER NOT NULL REFERENCES abonnements(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    envoyee_le INTEGER NOT NULL,
    PRIMARY KEY (abonnement_id, type)
  );
`;

const COLONNES_SEUILS = [
  'seuil_precipitation_probabilite',
  'seuil_chute_temperature',
  'seuil_rafales',
] as const;

/**
 * `CREATE TABLE IF NOT EXISTS` ne retrofit jamais de colonne sur un fichier
 * déjà existant — nécessaire pour le SQLite déjà en production sur le Pi.
 * `PRAGMA table_info` rend l'opération sans effet une fois les colonnes
 * présentes : pas besoin d'une table de version pour ce seul ajout additif.
 */
function migrerColonnesSeuils(base: DatabaseSync): void {
  const existantes = new Set(
    (base.prepare('PRAGMA table_info(abonnements)').all() as { name: string }[]).map((c) => c.name)
  );
  for (const colonne of COLONNES_SEUILS) {
    if (!existantes.has(colonne)) {
      base.exec(`ALTER TABLE abonnements ADD COLUMN ${colonne} INTEGER`);
    }
  }
}

/**
 * Ouvre (ou crée) la base des abonnements.
 *
 * `:memory:` pour les tests — une base par appel, jamais partagée. En
 * production, un fichier sur le volume Docker nommé `backend-data` (voir
 * `docker-compose.yml`) : sans lui, les abonnements seraient perdus à chaque
 * redéploiement, exactement comme le cache l'est déjà — sauf que le cache est
 * fait pour l'être, pas un abonnement qu'un utilisateur a explicitement demandé.
 */
export function ouvrirAbonnements(chemin: string): void {
  if (chemin !== ':memory:') {
    mkdirSync(dirname(chemin), { recursive: true });
  }
  db = new DatabaseSync(chemin);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrerColonnesSeuils(db);
}

export function fermerAbonnements(): void {
  db?.close();
  db = null;
}

function connexion(): DatabaseSync {
  if (!db) {
    throw new Error(
      'Base des abonnements non ouverte — appeler ouvrirAbonnements() au démarrage (voir app.ts).'
    );
  }
  return db;
}

/**
 * Enregistre un abonnement. Un même `endpoint` réabonné (ex. changement de
 * ville) remplace l'entrée existante plutôt que d'en créer une seconde — un
 * navigateur ne porte qu'un abonnement push actif à la fois pour cette origine.
 */
export function ajouterAbonnement(a: NouvelAbonnement): void {
  connexion()
    .prepare(
      `INSERT INTO abonnements (ville, endpoint, p256dh, auth, cree_le,
         seuil_precipitation_probabilite, seuil_chute_temperature, seuil_rafales)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         ville = excluded.ville,
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         seuil_precipitation_probabilite = excluded.seuil_precipitation_probabilite,
         seuil_chute_temperature = excluded.seuil_chute_temperature,
         seuil_rafales = excluded.seuil_rafales`
    )
    .run(
      a.ville,
      a.endpoint,
      a.p256dh,
      a.auth,
      Date.now(),
      a.seuils?.precipitationProbabilite ?? null,
      a.seuils?.chuteTemperature ?? null,
      a.seuils?.rafales ?? null
    );
}

/** Retire un abonnement par son `endpoint` — désabonnement volontaire ou expiré (410/404 Web Push). */
export function supprimerAbonnement(endpoint: string): void {
  connexion().prepare('DELETE FROM abonnements WHERE endpoint = ?').run(endpoint);
}

interface LigneAbonnement {
  id: number;
  ville: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  creeLe: number;
  precipitationProbabilite: number | null;
  chuteTemperature: number | null;
  rafales: number | null;
}

export function abonnementsParVille(ville: string): Abonnement[] {
  const lignes = connexion()
    .prepare(
      `SELECT id, ville, endpoint, p256dh, auth, cree_le AS creeLe,
              seuil_precipitation_probabilite AS precipitationProbabilite,
              seuil_chute_temperature AS chuteTemperature,
              seuil_rafales AS rafales
       FROM abonnements WHERE ville = ? ORDER BY id`
    )
    .all(ville) as unknown as LigneAbonnement[];

  return lignes.map(
    ({
      id,
      ville: v,
      endpoint,
      p256dh,
      auth,
      creeLe,
      precipitationProbabilite,
      chuteTemperature,
      rafales,
    }) => ({
      id,
      ville: v,
      endpoint,
      p256dh,
      auth,
      creeLe,
      seuils: {
        ...(precipitationProbabilite != null && { precipitationProbabilite }),
        ...(chuteTemperature != null && { chuteTemperature }),
        ...(rafales != null && { rafales }),
      },
    })
  );
}

/** Villes ayant au moins un abonnement — évite d'interroger Open-Meteo pour les autres au cycle horaire. */
export function villesAbonnees(): string[] {
  const lignes = connexion().prepare('SELECT DISTINCT ville FROM abonnements').all() as {
    ville: string;
  }[];
  return lignes.map((l) => l.ville);
}

/** Une alerte de ce type a-t-elle déjà été envoyée à cet abonnement, sans avoir été effacée depuis ? */
export function dejaEnvoyee(abonnementId: number, type: string): boolean {
  const ligne = connexion()
    .prepare('SELECT 1 FROM alertes_envoyees WHERE abonnement_id = ? AND type = ?')
    .get(abonnementId, type);
  return ligne !== undefined;
}

export function marquerEnvoyee(abonnementId: number, type: string): void {
  connexion()
    .prepare(
      `INSERT INTO alertes_envoyees (abonnement_id, type, envoyee_le) VALUES (?, ?, ?)
       ON CONFLICT(abonnement_id, type) DO UPDATE SET envoyee_le = excluded.envoyee_le`
    )
    .run(abonnementId, type, Date.now());
}

/**
 * Efface l'anti-spam d'un type qui ne se vérifie plus pour cet abonnement —
 * une nouvelle occurrence de la même situation pourra à nouveau notifier.
 */
export function effacerEnvoyee(abonnementId: number, type: string): void {
  connexion()
    .prepare('DELETE FROM alertes_envoyees WHERE abonnement_id = ? AND type = ?')
    .run(abonnementId, type);
}

/** Diagnostic — nombre total d'abonnements. */
export function nombreAbonnements(): number {
  const ligne = connexion().prepare('SELECT COUNT(*) AS n FROM abonnements').get() as {
    n: number;
  };
  return ligne.n;
}
