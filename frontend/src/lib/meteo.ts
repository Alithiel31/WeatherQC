interface EntreeWMO {
  description: string;
  iconJour: string;
  iconNuit: string;
}

const WMO: Record<number, EntreeWMO> = {
  0: { description: 'Ciel dégagé', iconJour: '☀️', iconNuit: '🌙' },
  1: { description: 'Généralement dégagé', iconJour: '🌤️', iconNuit: '🌙' },
  2: { description: 'Partiellement nuageux', iconJour: '⛅', iconNuit: '☁️' },
  3: { description: 'Couvert', iconJour: '☁️', iconNuit: '☁️' },
  45: { description: 'Brouillard', iconJour: '🌫️', iconNuit: '🌫️' },
  48: { description: 'Brouillard givrant', iconJour: '🌫️', iconNuit: '🌫️' },
  51: { description: 'Bruine légère', iconJour: '🌦️', iconNuit: '🌧️' },
  53: { description: 'Bruine', iconJour: '🌦️', iconNuit: '🌧️' },
  55: { description: 'Bruine forte', iconJour: '🌧️', iconNuit: '🌧️' },
  56: { description: 'Bruine verglaçante', iconJour: '🌧️', iconNuit: '🌧️' },
  57: { description: 'Bruine verglaçante forte', iconJour: '🌧️', iconNuit: '🌧️' },
  61: { description: 'Pluie légère', iconJour: '🌦️', iconNuit: '🌧️' },
  63: { description: 'Pluie', iconJour: '🌧️', iconNuit: '🌧️' },
  65: { description: 'Pluie forte', iconJour: '🌧️', iconNuit: '🌧️' },
  66: { description: 'Pluie verglaçante', iconJour: '🌧️', iconNuit: '🌧️' },
  67: { description: 'Pluie verglaçante forte', iconJour: '🌧️', iconNuit: '🌧️' },
  71: { description: 'Neige légère', iconJour: '🌨️', iconNuit: '🌨️' },
  73: { description: 'Neige', iconJour: '❄️', iconNuit: '❄️' },
  75: { description: 'Neige forte', iconJour: '❄️', iconNuit: '❄️' },
  77: { description: 'Grésil', iconJour: '🌨️', iconNuit: '🌨️' },
  80: { description: 'Averses légères', iconJour: '🌦️', iconNuit: '🌧️' },
  81: { description: 'Averses', iconJour: '🌧️', iconNuit: '🌧️' },
  82: { description: 'Averses violentes', iconJour: '⛈️', iconNuit: '⛈️' },
  85: { description: 'Averses de neige', iconJour: '🌨️', iconNuit: '🌨️' },
  86: { description: 'Fortes averses de neige', iconJour: '❄️', iconNuit: '❄️' },
  95: { description: 'Orage', iconJour: '⛈️', iconNuit: '⛈️' },
  96: { description: 'Orage avec grêle', iconJour: '⛈️', iconNuit: '⛈️' },
  99: { description: 'Orage avec forte grêle', iconJour: '⛈️', iconNuit: '⛈️' },
};

/** Marque d'une donnée absente. Un seul endroit décide de sa représentation. */
export const VALEUR_ABSENTE = '—';

/**
 * `code` est nullable : Open-Meteo laisse des trous en fin de série. Les corps
 * ci-dessous le toléraient déjà — seules les signatures affirmaient le contraire.
 */
export function descriptionMeteo(code: number | null): string {
  if (code === null) return 'Conditions inconnues';
  return WMO[code]?.description ?? 'Conditions inconnues';
}

export function iconeMeteo(code: number | null, jour = true): string {
  const entry = code === null ? undefined : WMO[code];
  if (!entry) return '❔';
  return jour ? entry.iconJour : entry.iconNuit;
}

/**
 * Température arrondie, ou `—` quand Open-Meteo n'a rien à cette échéance.
 *
 * Sans ce garde-fou, `Math.round(null)` vaut `0` : une valeur absente s'affichait
 * « 0° », indiscernable d'un vrai zéro — le pire résultat possible ici.
 */
export function degres(valeur: number | null): string {
  return valeur === null ? VALEUR_ABSENTE : `${Math.round(valeur)}°`;
}

export function familleMeteo(code: number): string {
  if (code === 0 || code === 1) return 'degage';
  if (code === 2 || code === 3) return 'nuageux';
  if (code === 45 || code === 48) return 'brouillard';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'neige';
  if (code >= 95) return 'orage';
  return 'pluie';
}

const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function jourCourt(dateStr: string): string {
  return JOURS[new Date(`${dateStr}T12:00:00`).getDay()];
}

export function jourLong(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  return `${JOURS_LONGS[d.getDay()]} ${d.getDate()}`;
}

export function heureCourte(isoStr: string): string {
  return `${new Date(isoStr).getHours()} h`;
}

/** Accepte une chaîne ISO ou un instant en millisecondes (frames RainViewer). */
export function heureMinute(instant: string | number): string {
  const d = new Date(instant);
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
}
