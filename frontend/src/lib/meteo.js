// Codes météo WMO -> libellé français + icône
const WMO = {
  0: ["Ciel dégagé", "☀️", "🌙"],
  1: ["Généralement dégagé", "🌤️", "🌙"],
  2: ["Partiellement nuageux", "⛅", "☁️"],
  3: ["Couvert", "☁️", "☁️"],
  45: ["Brouillard", "🌫️", "🌫️"],
  48: ["Brouillard givrant", "🌫️", "🌫️"],
  51: ["Bruine légère", "🌦️", "🌧️"],
  53: ["Bruine", "🌦️", "🌧️"],
  55: ["Bruine forte", "🌧️", "🌧️"],
  56: ["Bruine verglaçante", "🌧️", "🌧️"],
  57: ["Bruine verglaçante forte", "🌧️", "🌧️"],
  61: ["Pluie légère", "🌦️", "🌧️"],
  63: ["Pluie", "🌧️", "🌧️"],
  65: ["Pluie forte", "🌧️", "🌧️"],
  66: ["Pluie verglaçante", "🌧️", "🌧️"],
  67: ["Pluie verglaçante forte", "🌧️", "🌧️"],
  71: ["Neige légère", "🌨️", "🌨️"],
  73: ["Neige", "❄️", "❄️"],
  75: ["Neige forte", "❄️", "❄️"],
  77: ["Grésil", "🌨️", "🌨️"],
  80: ["Averses légères", "🌦️", "🌧️"],
  81: ["Averses", "🌧️", "🌧️"],
  82: ["Averses violentes", "⛈️", "⛈️"],
  85: ["Averses de neige", "🌨️", "🌨️"],
  86: ["Fortes averses de neige", "❄️", "❄️"],
  95: ["Orage", "⛈️", "⛈️"],
  96: ["Orage avec grêle", "⛈️", "⛈️"],
  99: ["Orage avec forte grêle", "⛈️", "⛈️"],
};

export function descriptionMeteo(code) {
  return (WMO[code] || ["Conditions inconnues"])[0];
}

export function iconeMeteo(code, jour = true) {
  const entry = WMO[code];
  if (!entry) return "❔";
  return jour ? entry[1] : entry[2];
}

// Famille de conditions -> sert au dégradé du ciel
export function familleMeteo(code) {
  if (code === 0 || code === 1) return "degage";
  if (code === 2 || code === 3) return "nuageux";
  if (code === 45 || code === 48) return "brouillard";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "neige";
  if (code >= 95) return "orage";
  return "pluie";
}

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const JOURS_LONGS = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
];

export function jourCourt(dateStr) {
  return JOURS[new Date(dateStr + "T12:00:00").getDay()];
}

export function jourLong(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return `${JOURS_LONGS[d.getDay()]} ${d.getDate()}`;
}

export function heureCourte(isoStr) {
  return new Date(isoStr).getHours() + " h";
}

export function heureMinute(isoStr) {
  const d = new Date(isoStr);
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
}
