/**
 * Accès à `localStorage` qui ne peut pas faire tomber l'application.
 *
 * Deux pannes réelles motivent ce module. Une valeur corrompue d'abord :
 * `JSON.parse` jette pendant l'initialisation du composant — donc avant le
 * premier rendu — et la page reste blanche jusqu'à un vidage manuel du stockage.
 * Un stockage refusé ensuite (Safari en navigation privée, cookies bloqués) :
 * `localStorage` lui-même jette, à la lecture comme à l'écriture.
 *
 * Dans les deux cas, perdre une préférence est acceptable ; perdre l'application
 * ne l'est pas.
 */

export function lireTexte(cle: string, defaut = ''): string {
  try {
    return localStorage.getItem(cle) ?? defaut;
  } catch {
    return defaut;
  }
}

export function lireJSON<T>(cle: string, defaut: T): T {
  let brut: string | null;
  try {
    brut = localStorage.getItem(cle);
  } catch {
    return defaut;
  }

  if (brut === null) return defaut;

  try {
    return JSON.parse(brut) as T;
  } catch {
    // La valeur ne redeviendra jamais lisible : la retirer évite de repayer
    // l'échec à chaque démarrage.
    supprimer(cle);
    return defaut;
  }
}

export function ecrire(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // Quota dépassé ou stockage refusé : la préférence ne survivra pas à la
    // session. Ça ne justifie pas d'interrompre l'utilisateur.
  }
}

export function ecrireJSON(cle: string, valeur: unknown): void {
  ecrire(cle, JSON.stringify(valeur));
}

export function supprimer(cle: string): void {
  try {
    localStorage.removeItem(cle);
  } catch {
    // Même raisonnement qu'à l'écriture.
  }
}
