import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { creerAnimation } from '../../src/lib/animationFrames.svelte.ts';
import type { ImageRainViewer } from '../../src/lib/types.ts';

const frames: ImageRainViewer[] = [
  { path: '/a', time: 1_700_000_000 },
  { path: '/b', time: 1_700_000_600 },
  { path: '/c', time: 1_700_001_200 },
];

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('creerAnimation', () => {
  it('démarre vide', () => {
    const animation = creerAnimation(() => {});

    expect(animation.frames).toEqual([]);
    expect(animation.lecture).toBe(false);
  });

  it('se place sur l’image la plus récente en remplaçant la série', () => {
    const vues: number[] = [];
    const animation = creerAnimation((i) => vues.push(i));

    animation.remplacer(frames);

    expect(animation.index).toBe(2);
    expect(vues).toEqual([2]);
  });

  it('boucle sur la première image après la dernière', () => {
    const animation = creerAnimation(() => {});
    animation.remplacer(frames);

    animation.suivant();

    expect(animation.index).toBe(0);
  });

  it('ne fait rien sans image — pas de modulo par zéro', () => {
    const auChangement = vi.fn();
    const animation = creerAnimation(auChangement);

    animation.suivant();

    expect(animation.index).toBe(0);
    expect(auChangement).not.toHaveBeenCalled();
  });

  it('avance tout seul une fois la lecture lancée', () => {
    const animation = creerAnimation(() => {});
    animation.remplacer(frames);

    animation.basculerLecture();
    expect(animation.lecture).toBe(true);

    vi.advanceTimersByTime(600);
    expect(animation.index).toBe(0);
    vi.advanceTimersByTime(600);
    expect(animation.index).toBe(1);
  });

  it('s’arrête au second basculement', () => {
    const animation = creerAnimation(() => {});
    animation.remplacer(frames);

    animation.basculerLecture();
    animation.basculerLecture();
    vi.advanceTimersByTime(6000);

    expect(animation.lecture).toBe(false);
    expect(animation.index).toBe(2);
  });

  it('rend la main à l’utilisateur sur un déplacement manuel', () => {
    const animation = creerAnimation(() => {});
    animation.remplacer(frames);
    animation.basculerLecture();

    animation.deplacerVers(0);
    vi.advanceTimersByTime(6000);

    expect(animation.lecture).toBe(false);
    expect(animation.index).toBe(0);
  });

  // Sans `detruire`, le minuteur survivait au composant et continuait de tourner.
  it('arrête le minuteur à la destruction', () => {
    const auChangement = vi.fn();
    const animation = creerAnimation(auChangement);
    animation.remplacer(frames);
    animation.basculerLecture();
    auChangement.mockClear();

    animation.detruire();
    vi.advanceTimersByTime(6000);

    expect(auChangement).not.toHaveBeenCalled();
  });
});
