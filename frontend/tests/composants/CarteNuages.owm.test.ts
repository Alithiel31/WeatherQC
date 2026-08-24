import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import type { FramesRainViewer } from '../../src/lib/types.ts';

// Fichier séparé de `CarteNuages.test.ts` : la clé OWM est lue une seule fois,
// au chargement du module, donc `vi.stubEnv` doit précéder l'import du
// composant — impossible à faire varier d'un test à l'autre dans le même fichier.
vi.stubEnv('VITE_OPENWEATHERMAP_KEY', 'clé-test');

const { tuiles, leaflet } = vi.hoisted(() => {
  const tuiles: { url: string; opacite: number }[] = [];
  const carte = {
    setView: vi.fn(),
    getZoom: vi.fn(() => 7),
    removeLayer: vi.fn(),
    remove: vi.fn(),
  };
  return {
    tuiles,
    leaflet: {
      default: {
        map: vi.fn(() => carte),
        tileLayer: vi.fn((url: string) => {
          const couche = {
            url,
            opacite: 0,
            addTo: () => couche,
            setOpacity(o: number) {
              couche.opacite = o;
            },
          };
          tuiles.push(couche as unknown as { url: string; opacite: number });
          return couche;
        }),
        circleMarker: vi.fn(() => {
          const marqueur = { addTo: () => marqueur, setLatLng: vi.fn() };
          return marqueur;
        }),
      },
    },
  };
});

vi.mock('leaflet', () => leaflet);
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const { framesRainViewer } = vi.hoisted(() => ({ framesRainViewer: vi.fn() }));
vi.mock('../../src/lib/api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/api.ts')>()),
  framesRainViewer,
}));

const { default: CarteNuages } = await import('../../src/lib/CarteNuages.svelte');

const props = { latitude: 45.5, longitude: -73.6, nom: 'Montréal' };

function frames(satellite: number, radar: number): FramesRainViewer {
  return {
    hote: 'https://tuiles.exemple',
    satellite: Array.from({ length: satellite }, (_, i) => ({ path: `/s${i}`, time: 1000 + i })),
    radar: Array.from({ length: radar }, (_, i) => ({ path: `/r${i}`, time: 2000 + i })),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tuiles.length = 0;
});

describe('CarteNuages — repli OpenWeatherMap (clé configurée)', () => {
  it('reste sur « Nuages » et affiche la couverture nuageuse quand le satellite RainViewer est vide', async () => {
    framesRainViewer.mockResolvedValue(frames(0, 4));

    render(CarteNuages, props);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Nuages' }).getAttribute('aria-pressed')).toBe(
        'true'
      )
    );
    expect(await screen.findByText(/Couverture nuageuse estimée/)).toBeTruthy();
    expect(screen.queryByText(/ne sont pas disponibles/)).toBeNull();
    await waitFor(() =>
      expect(tuiles.some((t) => t.url.includes('tile.openweathermap.org/map/clouds_new'))).toBe(
        true
      )
    );
  });

  it('revient à l’animation normale dès que le satellite RainViewer fournit des images', async () => {
    framesRainViewer.mockResolvedValue(frames(3, 4));

    render(CarteNuages, props);

    expect(await screen.findByRole('slider')).toBeTruthy();
    expect(screen.queryByText(/Couverture nuageuse estimée/)).toBeNull();
  });
});
