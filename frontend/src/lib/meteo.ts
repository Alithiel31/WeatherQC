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

export function descriptionMeteo(code: number): string {
  return WMO[code]?.description ?? 'Conditions inconnues';
}

export function iconeMeteo(code: number, jour = true): string {
  const entry = WMO[code];
  if (!entry) return '❔';
  return jour ? entry.iconJour : entry.iconNuit;
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

export function heureMinute(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
}
