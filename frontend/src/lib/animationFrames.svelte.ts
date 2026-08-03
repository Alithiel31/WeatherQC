import type { ImageRainViewer } from './types.ts';

/** Cadence de lecture — assez lente pour suivre une boucle de 10 à 12 images. */
const INTERVALLE_MS = 600;

/**
 * Machine d'animation des images RainViewer : quelle image est visible, la
 * lecture automatique et son minuteur.
 *
 * Extraite de `CarteNuages.svelte`, qui mêlait le cycle de vie Leaflet, la
 * récupération réseau et cette logique de défilement. Le composant garde la
 * carte ; l'affichage effectif d'une image reste à sa charge, via `auChangement`
 * — c'est lui qui connaît les couches de tuiles.
 */
export function creerAnimation(auChangement: (index: number) => void) {
  let frames = $state<ImageRainViewer[]>([]);
  let index = $state(0);
  let lecture = $state(false);
  let minuterie: ReturnType<typeof setInterval> | null = null;

  function stopperMinuterie(): void {
    if (minuterie) clearInterval(minuterie);
    minuterie = null;
  }

  function allerA(i: number): void {
    index = i;
    auChangement(i);
  }

  function suivant(): void {
    if (!frames.length) return;
    allerA((index + 1) % frames.length);
  }

  return {
    get frames() {
      return frames;
    },
    get index() {
      return index;
    },
    get lecture() {
      return lecture;
    },

    /** Remplace la série et se place sur l'image la plus récente. */
    remplacer(nouvelles: ImageRainViewer[]): void {
      frames = nouvelles;
      allerA(nouvelles.length - 1);
    },

    allerA,
    suivant,

    basculerLecture(): void {
      lecture = !lecture;
      stopperMinuterie();
      if (lecture) minuterie = setInterval(suivant, INTERVALLE_MS);
    },

    /** Déplacement manuel : la lecture s'interrompt, l'utilisateur reprend la main. */
    deplacerVers(i: number): void {
      lecture = false;
      stopperMinuterie();
      allerA(i);
    },

    /** À appeler à la destruction du composant : sans ça, le minuteur survit. */
    detruire(): void {
      stopperMinuterie();
    },
  };
}

export type Animation = ReturnType<typeof creerAnimation>;
