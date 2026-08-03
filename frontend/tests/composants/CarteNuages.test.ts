import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import type { FramesRainViewer } from '../../src/lib/types.ts';

// Leaflet manipule le DOM en supposant un layout réel, absent de jsdom :
// on le remplace par des doublures qui enregistrent les appels.
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
  framesRainViewer.mockResolvedValue(frames(3, 4));
});

describe('CarteNuages', () => {
  it('affiche les contrôles d’animation une fois les images chargées', async () => {
    render(CarteNuages, props);

    expect(await screen.findByRole('slider')).toBeTruthy();
    expect(screen.queryByText(/ne sont pas disponibles/)).toBeNull();
  });

  it('affiche un message de repli quand RainViewer est injoignable', async () => {
    framesRainViewer.mockRejectedValue(new Error('RainViewer indisponible'));

    render(CarteNuages, props);

    expect(await screen.findByText(/ne sont pas disponibles/)).toBeTruthy();
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('construit les tuiles satellite depuis l’hôte renvoyé par l’index', async () => {
    render(CarteNuages, props);

    await waitFor(() => expect(tuiles.some((t) => t.url.includes('/s0/'))).toBe(true));
    expect(tuiles.find((t) => t.url.includes('/s0/'))!.url).toContain('https://tuiles.exemple');
  });

  it('n’affiche que la dernière image du lot', async () => {
    render(CarteNuages, props);

    await waitFor(() => {
      const satellite = tuiles.filter((t) => t.url.includes('/s'));
      expect(satellite.map((t) => t.opacite)).toEqual([0, 0, 0.75]);
    });
  });

  it('bascule automatiquement en radar quand aucune image satellite n’est disponible', async () => {
    framesRainViewer.mockResolvedValue(frames(0, 4));

    render(CarteNuages, props);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Radar' }).getAttribute('aria-pressed')).toBe(
        'true'
      )
    );
  });

  it('reconstruit les couches avec les tuiles radar au changement de mode', async () => {
    const user = userEvent.setup();
    render(CarteNuages, props);
    await screen.findByRole('slider');

    await user.click(screen.getByRole('button', { name: 'Radar' }));

    await waitFor(() => expect(tuiles.filter((t) => t.url.includes('/r0/'))).toHaveLength(1));
  });

  it('ignore un changement vers le mode déjà actif', async () => {
    const user = userEvent.setup();
    render(CarteNuages, props);
    await screen.findByRole('slider');
    const avant = tuiles.length;

    await user.click(screen.getByRole('button', { name: 'Nuages' }));

    expect(tuiles).toHaveLength(avant);
  });
});
