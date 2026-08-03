import type { ReponseMeteo, LieuCP, FramesRainViewer, VilleDisponible } from './types.ts';

/**
 * Hôte des tuiles, en repli si le backend n'en déclare pas.
 *
 * Les tuiles restent chargées en direct depuis RainViewer : seul l'index JSON
 * passe par le backend. Les faire transiter par le Raspberry Pi coûterait bien
 * plus cher que ce que le cache ferait gagner.
 */
export const HOTE_TUILES_DEFAUT = 'https://tilecache.rainviewer.com';

/**
 * Erreur portant un message destiné à l'utilisateur, fourni par le backend.
 * Se distingue d'une panne réseau, où l'on ne peut afficher qu'un message générique.
 */
export class ErreurApi extends Error {}

/**
 * Délai maximal d'un appel au backend. Celui-ci borne déjà ses propres appels
 * amont à 5 s, mais rien ne borne le trajet navigateur → nginx → backend : une
 * requête qui pend laisse le spinner tourner indéfiniment.
 */
const DELAI_MAX_MS = 10_000;

/** Combine l'annulation demandée par l'appelant et le délai maximal. */
function signalRequete(signal?: AbortSignal): AbortSignal {
  const delai = AbortSignal.timeout(DELAI_MAX_MS);
  return signal ? AbortSignal.any([signal, delai]) : delai;
}

/**
 * Villes servies par le backend, en dernier recours quand il est injoignable.
 *
 * Le sélecteur doit s'afficher au premier rendu même hors ligne — c'est une PWA.
 * La source de vérité reste `backend/src/data/cities.ts` : cette liste n'est là
 * que pour le temps qu'il faut à `/api/villes` de répondre.
 */
export const VILLES_REPLI: VilleDisponible[] = [
  { id: 'montreal', nom: 'Montréal' },
  { id: 'quebec', nom: 'Québec' },
];

export async function villesDisponibles(signal?: AbortSignal): Promise<VilleDisponible[]> {
  const res = await fetch('/api/villes', { signal: signalRequete(signal) });
  if (!res.ok) throw new ErreurApi(await messageErreur(res, 'Liste des villes indisponible'));
  return (await res.json()) as VilleDisponible[];
}

export async function previsionsVille(ville: string, signal?: AbortSignal): Promise<ReponseMeteo> {
  return recupererPrevisions(`/api/previsions/${ville}`, signal);
}

export async function previsionsCoordonnees(
  lieu: LieuCP,
  signal?: AbortSignal
): Promise<ReponseMeteo> {
  const q = new URLSearchParams({
    lat: String(lieu.latitude),
    lon: String(lieu.longitude),
    nom: lieu.nom,
  });
  return recupererPrevisions(`/api/previsions-coordonnees?${q}`, signal);
}

/**
 * Toutes les erreurs du backend partagent l'enveloppe `{ status, error }`.
 * Un corps illisible — page HTML d'un proxy, réponse vide — retombe sur `defaut`
 * plutôt que de masquer la panne derrière une erreur de parsing.
 */
async function messageErreur(res: Response, defaut: string): Promise<string> {
  try {
    const corps = (await res.json()) as { error?: string };
    return corps.error ?? defaut;
  } catch {
    return defaut;
  }
}

async function recupererPrevisions(url: string, signal?: AbortSignal): Promise<ReponseMeteo> {
  const res = await fetch(url, { signal: signalRequete(signal) });
  if (!res.ok) throw new ErreurApi(await messageErreur(res, 'Réponse invalide du serveur'));
  return (await res.json()) as ReponseMeteo;
}

export async function geocoder(codePostal: string): Promise<LieuCP> {
  const res = await fetch(`/api/geocode/${encodeURIComponent(codePostal)}`, {
    signal: signalRequete(),
  });
  // Sans le message du backend, une panne amont (502) ou un quota dépassé (429)
  // s'affichait « Code postal introuvable » — un diagnostic faux.
  if (!res.ok) throw new ErreurApi(await messageErreur(res, 'Code postal introuvable.'));
  return (await res.json()) as LieuCP;
}

/**
 * Index des images satellite et radar, servi par le backend.
 *
 * L'appel partait autrefois droit sur `api.rainviewer.com` : seule dépendance
 * tierce sans cache ni quota côté serveur, alors qu'Open-Meteo et Zippopotam
 * sont bornés. Le passer par `/api/rainviewer` lui donne le même traitement —
 * délai maximal, nouvelle tentative, validation de schéma et cache partagé —
 * et le découpage des séries se fait désormais en amont.
 *
 * `hoteActuel` reste un repli : le backend garantit un hôte, mais conserver
 * celui déjà utilisé pour les tuiles ne coûte rien.
 */
export async function framesRainViewer(hoteActuel = HOTE_TUILES_DEFAUT): Promise<FramesRainViewer> {
  const res = await fetch('/api/rainviewer', { signal: signalRequete() });
  if (!res.ok) throw new ErreurApi(await messageErreur(res, 'RainViewer indisponible'));
  const data = (await res.json()) as FramesRainViewer;
  return {
    hote: data.hote || hoteActuel,
    satellite: data.satellite ?? [],
    radar: data.radar ?? [],
  };
}
