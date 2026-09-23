/**
 * Détection des changements de météo subits, à partir des prévisions horaires.
 *
 * Fonction pure : ni réseau, ni horloge, ni stockage. La tâche périodique lui
 * fournit l'état actuel et les heures à venir, elle rend les alertes. Tout ce
 * qui décide *si* on envoie (anti-spam, heures calmes, abonnements) vit
 * ailleurs : ici on ne répond qu'à « qu'est-ce qui arrive ? ».
 *
 * Unités : °C et km/h, celles d'Open-Meteo par défaut. La conversion impériale
 * se fera à la rédaction, selon la préférence de l'abonné.
 */

export type TypeAlerte = 'precipitation' | 'chute-temperature' | 'vent' | 'verglas' | 'orage';

/**
 * Une heure de prévision. `heures[0]` doit être la première heure *à venir* —
 * c'est déjà ce que produit `fetchForecast` en découpant à partir de `nowIndex`.
 */
export interface HeurePrevue {
  /** Heure locale Open-Meteo, `YYYY-MM-DDTHH:mm`. */
  heure: string;
  temperature: number | null;
  /** Code météo WMO. */
  code: number | null;
  /** Probabilité de précipitation, en %. */
  precipitation: number | null;
  /** Rafales à 10 m, en km/h. */
  rafales: number | null;
}

export interface EtatActuel {
  temperature: number;
  code: number;
}

export interface Alerte {
  type: TypeAlerte;
  /** Une alerte importante passe outre les heures calmes. */
  importante: boolean;
  /** Première heure concernée. */
  heure: string;
  /** Ce qui a franchi le seuil : %, écart en °C, km/h ou code WMO selon le type. */
  valeur: number;
  /** Précisé pour `precipitation` seulement. */
  nature?: 'pluie' | 'neige';
}

export interface Seuils {
  /** Probabilité (%) à partir de laquelle une précipitation est annoncée. */
  precipitationProbabilite: number;
  /** Fenêtre (h) de la précipitation « imminente ». */
  precipitationHorizonH: number;
  /** Baisse (°C) jugée brutale. */
  chuteTemperature: number;
  chuteHorizonH: number;
  /** Rafales (km/h) jugées fortes. */
  rafales: number;
  /** Fenêtre (h) pour le vent, le verglas et l'orage. */
  horizonH: number;
}

export const SEUILS_DEFAUT: Readonly<Seuils> = {
  precipitationProbabilite: 70,
  precipitationHorizonH: 2,
  chuteTemperature: 8,
  chuteHorizonH: 6,
  rafales: 60,
  horizonH: 6,
};

// Codes WMO — https://open-meteo.com/en/docs (section « Weather variable documentation »)
const CODES_VERGLAS = new Set([56, 57, 66, 67]);
const estVerglas = (code: number): boolean => CODES_VERGLAS.has(code);
const estOrage = (code: number): boolean => code >= 95 && code <= 99;
const estNeige = (code: number): boolean =>
  (code >= 71 && code <= 77) || code === 85 || code === 86;
const estPrecipitation = (code: number): boolean =>
  (code >= 51 && code <= 67) ||
  (code >= 71 && code <= 77) ||
  (code >= 80 && code <= 86) ||
  estOrage(code);

function detecterPrecipitation(
  actuel: EtatActuel,
  heures: HeurePrevue[],
  s: Seuils
): Alerte | null {
  // Il pleut déjà : annoncer qu'il va pleuvoir n'apprend rien à personne.
  if (estPrecipitation(actuel.code)) return null;

  for (const h of heures.slice(0, s.precipitationHorizonH)) {
    if (h.precipitation !== null && h.precipitation >= s.precipitationProbabilite) {
      return {
        type: 'precipitation',
        importante: false,
        heure: h.heure,
        valeur: h.precipitation,
        nature: h.code !== null && estNeige(h.code) ? 'neige' : 'pluie',
      };
    }
  }
  return null;
}

function detecterChuteTemperature(
  actuel: EtatActuel,
  heures: HeurePrevue[],
  s: Seuils
): Alerte | null {
  let plusFroide: { heure: string; temperature: number } | null = null;
  for (const h of heures.slice(0, s.chuteHorizonH)) {
    if (h.temperature === null) continue;
    if (plusFroide === null || h.temperature < plusFroide.temperature) {
      plusFroide = { heure: h.heure, temperature: h.temperature };
    }
  }
  if (plusFroide === null) return null;

  const ecart = actuel.temperature - plusFroide.temperature;
  if (ecart < s.chuteTemperature) return null;

  return {
    type: 'chute-temperature',
    importante: false,
    heure: plusFroide.heure,
    valeur: Math.round(ecart),
  };
}

function detecterVent(heures: HeurePrevue[], s: Seuils): Alerte | null {
  const fenetre = heures.slice(0, s.horizonH);
  const debut = fenetre.find((h) => h.rafales !== null && h.rafales >= s.rafales);
  if (!debut) return null;

  // L'heure annoncée est le début du coup de vent, la valeur son pic : « à
  // partir de 16 h, jusqu'à 85 km/h » est ce qu'on veut lire.
  return {
    type: 'vent',
    importante: false,
    heure: debut.heure,
    valeur: Math.max(...fenetre.map((h) => h.rafales ?? 0)),
  };
}

/** Verglas et orage se reconnaissent au seul code WMO, et sont toujours importants. */
function detecterCode(
  heures: HeurePrevue[],
  s: Seuils,
  type: 'verglas' | 'orage',
  correspond: (code: number) => boolean
): Alerte | null {
  for (const h of heures.slice(0, s.horizonH)) {
    if (h.code !== null && correspond(h.code)) {
      return { type, importante: true, heure: h.heure, valeur: h.code };
    }
  }
  return null;
}

/**
 * Les alertes importantes viennent en tête : si l'anti-spam n'en laisse passer
 * qu'une, ce sera la plus grave.
 */
export function detecterAlertes(
  actuel: EtatActuel,
  heures: HeurePrevue[],
  seuils: Seuils = SEUILS_DEFAUT
): Alerte[] {
  return [
    detecterCode(heures, seuils, 'verglas', estVerglas),
    detecterCode(heures, seuils, 'orage', estOrage),
    detecterPrecipitation(actuel, heures, seuils),
    detecterChuteTemperature(actuel, heures, seuils),
    detecterVent(heures, seuils),
  ].filter((a): a is Alerte => a !== null);
}

/** « 2026-09-23T16:00 » → « 16 h » (usage québécois). */
function formaterHeure(iso: string): string {
  return `${Number(iso.slice(11, 13))} h`;
}

export interface Notification {
  titre: string;
  corps: string;
}

export function redigerNotification(alerte: Alerte, lieu: string): Notification {
  const vers = `vers ${formaterHeure(alerte.heure)}`;
  switch (alerte.type) {
    case 'precipitation':
      return {
        titre: `${alerte.nature === 'neige' ? 'Neige' : 'Pluie'} imminente · ${lieu}`,
        corps: `Probabilité de ${alerte.valeur} % ${vers}.`,
      };
    case 'chute-temperature':
      return {
        titre: `Chute de température · ${lieu}`,
        corps: `Jusqu'à ${alerte.valeur} °C de moins ${vers}.`,
      };
    case 'vent':
      return {
        titre: `Vents forts · ${lieu}`,
        corps: `Rafales jusqu'à ${alerte.valeur} km/h à partir de ${formaterHeure(alerte.heure)}.`,
      };
    case 'verglas':
      return {
        titre: `Risque de verglas · ${lieu}`,
        corps: `Pluie ou bruine verglaçante prévue ${vers}. Prudence sur la route.`,
      };
    case 'orage':
      return {
        titre: `Orage · ${lieu}`,
        corps: `Orage prévu ${vers}.`,
      };
  }
}
