import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Vérification numérique du contraste WCAG, faite sur les constantes CSS.
 *
 * Pourquoi ici plutôt que dans la suite axe : **axe ne sait pas mesurer le
 * contraste sur un fond en dégradé.** Vérifié sur cette application — il classe
 * les cinquante nœuds concernés en `incomplete` avec le motif « Element's
 * background color could not be determined due to a background gradient », et
 * `incomplete` n'est pas `violations`. Une suite axe qui n'assertionne que les
 * violations passe donc au vert avec du texte à 1.15:1, ce qui a été confirmé
 * en retirant le voile et en rejouant la suite : neuf tests verts.
 *
 * Le fond réel est ici entièrement déterminé par des littéraux CSS — deux
 * teintes de ciel, un voile de page, un voile de carte. Ils se composent
 * exactement, donc le rapport se calcule sans navigateur, et c'est le seul
 * moyen fiable trouvé de garder cette garantie.
 */

const src = (chemin: string) => readFileSync(resolve(__dirname, '../../src', chemin), 'utf8');

/** Luminance relative WCAG 2.x d'une couleur `#rrggbb`. */
function luminance(hex: string): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Composition alpha d'une couleur sur un fond opaque. */
function superposer(dessus: string, dessous: string, alpha: number): string {
  const lire = (h: string) =>
    [0, 2, 4].map((i) => parseInt(h.replace('#', '').slice(i, i + 2), 16));
  const [f, d] = [lire(dessus), lire(dessous)];
  const canal = (i: number) => Math.round(alpha * f[i] + (1 - alpha) * d[i]);
  return `#${[0, 1, 2].map((i) => canal(i).toString(16).padStart(2, '0')).join('')}`;
}

const app = src('App.svelte');

/**
 * Les deux teintes de chaque ciel, lues dans la feuille de style plutôt que
 * recopiées : une teinte modifiée sans repasser par ce calcul doit faire
 * échouer le test, pas le contourner.
 */
function cieux(): Array<{ regle: string; bas: string }> {
  return [...app.matchAll(/\.ciel([\w.,\s]*?)\{([^}]*--ciel-bas:\s*(#[0-9a-f]{6})[^}]*)\}/g)].map(
    (m) => ({ regle: `.ciel${m[1].trim()}`, bas: m[3] })
  );
}

/** Alpha du voile noir constant posé sur le ciel dans `main`. */
function voilePage(): number {
  const m = app.match(/linear-gradient\(rgba\(0,0,0,([\d.]+)\), rgba\(0,0,0,[\d.]+\)\)/);
  if (!m) throw new Error('voile de page introuvable dans App.svelte');
  return Number(m[1]);
}

/** Alpha du voile d'une carte (`Horaire`, `Quotidien`, `CarteNuages`). */
function voileCarte(fichier: string): number {
  const m = src(fichier).match(/section\s*\{[^}]*background:\s*rgba\(0,0,0,([\d.]+)\)/);
  if (!m) throw new Error(`voile de carte introuvable dans ${fichier}`);
  return Number(m[1]);
}

const SEUIL = 4.5;

describe('Contraste WCAG AA', () => {
  const scenarios = cieux();

  it('lit bien toutes les familles de ciel', () => {
    // Garde-fou du garde-fou : si l'expression régulière cesse de trouver les
    // ciels, les boucles ci-dessous ne testeraient plus rien en silence.
    expect(scenarios.length).toBeGreaterThanOrEqual(9);
  });

  describe.each(scenarios)('ciel $regle', ({ bas }) => {
    // Le bas du dégradé est le pire cas : c'est là que tous les ciels
    // s'éclaircissent, `neige` jusqu'à #b9cce0.
    const page = superposer('#000000', bas, voilePage());

    it('texte blanc posé à nu sur le ciel', () => {
      expect(contraste('#ffffff', page)).toBeGreaterThanOrEqual(SEUIL);
    });

    it.each([
      ['lib/Horaire.svelte', '#bfe3ff', 1],
      ['lib/Horaire.svelte', '#ffffff', 0.75],
      ['lib/Quotidien.svelte', '#bfe3ff', 1],
      ['lib/Quotidien.svelte', '#ffffff', 0.75],
      ['lib/CarteNuages.svelte', '#ffffff', 0.75],
    ])('%s : %s à opacité %s', (fichier, couleur, opacite) => {
      const carte = superposer('#000000', page, voileCarte(fichier));
      const texte = opacite === 1 ? couleur : superposer(couleur, carte, opacite);
      expect(contraste(texte, carte)).toBeGreaterThanOrEqual(SEUIL);
    });
  });
});
