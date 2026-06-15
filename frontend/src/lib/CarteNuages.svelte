<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';

  interface Props {
    latitude: number;
    longitude: number;
    nom?: string;
  }

  interface RainFrame {
    path: string;
    time: number;
  }

  interface RainViewerData {
    satellite: RainFrame[];
    radar: RainFrame[];
  }

  const { latitude, longitude, nom = '' }: Props = $props();

  // Leaflet objects — $state.raw() to avoid deep proxy wrapping
  let conteneur = $state.raw<HTMLDivElement | undefined>(undefined);
  let carte     = $state.raw<L.Map | undefined>(undefined);
  let marqueur  = $state.raw<L.CircleMarker | undefined>(undefined);
  let couches   = $state.raw<L.TileLayer[]>([]);

  let frames        = $state<RainFrame[]>([]);
  let index         = $state(0);
  let lecture       = $state(false);
  let mode          = $state<'satellite' | 'radar'>('satellite');
  let hote          = $state('https://tilecache.rainviewer.com');
  let donneesFrames = $state<RainViewerData | null>(null);
  let erreurCarte   = $state(false);
  let minuterie: ReturnType<typeof setInterval> | null = null;

  const reduireMouvement =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  function urlTuile(frame: RainFrame): string {
    return mode === 'satellite'
      ? `${hote}${frame.path}/256/{z}/{x}/{y}/0/0_0.png`
      : `${hote}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
  }

  function heureFrame(frame: RainFrame): string {
    const d = new Date(frame.time * 1000);
    return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
  }

  function viderCouches(): void {
    couches.forEach((c) => carte?.removeLayer(c));
    couches = [];
  }

  function construireCouches(): void {
    if (!carte) return;
    viderCouches();
    couches = frames.map((f) =>
      L.tileLayer(urlTuile(f), { opacity: 0, tileSize: 256, zIndex: 400 }).addTo(carte!)
    );
    index = frames.length - 1;
    afficherFrame(index);
  }

  function afficherFrame(i: number): void {
    couches.forEach((c, j) => c.setOpacity(j === i ? 0.75 : 0));
    index = i;
  }

  function suivant(): void {
    afficherFrame((index + 1) % frames.length);
  }

  function basculerLecture(): void {
    lecture = !lecture;
    if (minuterie) clearInterval(minuterie);
    if (lecture) minuterie = setInterval(suivant, 600);
  }

  function changerMode(nouveau: 'satellite' | 'radar'): void {
    if (mode === nouveau || !donneesFrames) return;
    mode = nouveau;
    frames = mode === 'satellite' ? donneesFrames.satellite : donneesFrames.radar;
    construireCouches();
  }

  async function chargerFrames(): Promise<void> {
    const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
    if (!res.ok) throw new Error('RainViewer indisponible');
    const data = await res.json();
    hote = data.host || hote;
    donneesFrames = {
      satellite: ((data.satellite?.infrared ?? []) as RainFrame[]).slice(-10),
      radar: ([
        ...(data.radar?.past ?? []),
        ...(data.radar?.nowcast ?? []),
      ] as RainFrame[]).slice(-12),
    };
    const satelliteVide = donneesFrames.satellite.length === 0;
    mode = satelliteVide ? 'radar' : 'satellite';
    frames = satelliteVide ? donneesFrames.radar : donneesFrames.satellite;
  }

  // Recentrer la carte quand le lieu change
  $effect(() => {
    if (carte && latitude && longitude) {
      carte.setView([latitude, longitude], carte.getZoom());
      marqueur?.setLatLng([latitude, longitude]);
    }
  });

  onMount(async () => {
    if (!conteneur) return;

    carte = L.map(conteneur, {
      center: [latitude, longitude],
      zoom: 7,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a> · Nuages <a href="https://www.rainviewer.com/">RainViewer</a>',
      maxZoom: 12,
    }).addTo(carte);

    marqueur = L.circleMarker([latitude, longitude], {
      radius: 7,
      color: '#fff',
      weight: 2,
      fillColor: '#ffd479',
      fillOpacity: 1,
    }).addTo(carte);

    try {
      await chargerFrames();
      construireCouches();
      if (!reduireMouvement) basculerLecture();
    } catch {
      erreurCarte = true;
    }
  });

  onDestroy(() => {
    if (minuterie) clearInterval(minuterie);
    carte?.remove();
  });
</script>

<section aria-label="Carte animée des nuages et précipitations">
  <header>
    <h2>Carte animée — {nom}</h2>
    <div class="modes" role="group" aria-label="Type de couche">
      <button
        class:active={mode === 'satellite'}
        onclick={() => changerMode('satellite')}
        aria-pressed={mode === 'satellite'}>Nuages</button>
      <button
        class:active={mode === 'radar'}
        onclick={() => changerMode('radar')}
        aria-pressed={mode === 'radar'}>Radar</button>
    </div>
  </header>

  <div class="carte" bind:this={conteneur}></div>

  {#if erreurCarte}
    <p class="erreur">Les images satellites ne sont pas disponibles pour le moment.</p>
  {:else if frames.length}
    <div class="controles">
      <button
        class="lecture"
        onclick={basculerLecture}
        aria-label={lecture ? 'Mettre en pause' : "Lancer l'animation"}
      >{lecture ? '⏸' : '▶'}</button>
      <input
        type="range"
        min="0"
        max={frames.length - 1}
        bind:value={index}
        oninput={() => {
          lecture = false;
          if (minuterie) clearInterval(minuterie);
          afficherFrame(index);
        }}
        aria-label="Position dans l'animation"
      />
      <span class="heure">{frames[index] ? heureFrame(frames[index]) : ''}</span>
    </div>
  {/if}
</section>

<style>
  section {
    background: rgba(255,255,255,0.12); border-radius: 1rem;
    padding: 1rem; margin-top: 0.9rem; backdrop-filter: blur(6px);
  }
  header {
    display: flex; justify-content: space-between; align-items: center;
    gap: 0.5rem; margin-bottom: 0.7rem;
  }
  h2 {
    margin: 0; font-size: 0.75rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.75;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .modes {
    display: inline-flex; gap: 0.2rem;
    background: rgba(0,0,0,0.25); border-radius: 999px; padding: 0.2rem; flex-shrink: 0;
  }
  .modes button {
    border: 0; background: transparent; color: #fff; font: inherit;
    font-size: 0.78rem; font-weight: 600; padding: 0.3rem 0.8rem;
    border-radius: 999px; cursor: pointer;
  }
  .modes button.active { background: #fff; color: #16314d; }
  .modes button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .carte { height: 16rem; border-radius: 0.7rem; overflow: hidden; }
  .controles { display: flex; align-items: center; gap: 0.7rem; margin-top: 0.7rem; }
  .lecture {
    border: 0; background: rgba(0,0,0,0.3); color: #fff;
    width: 2.2rem; height: 2.2rem; border-radius: 50%; font-size: 0.9rem;
    cursor: pointer; flex-shrink: 0;
  }
  .lecture:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  input[type="range"] { flex: 1; accent-color: #ffd479; }
  .heure { font-size: 0.85rem; font-variant-numeric: tabular-nums; min-width: 4rem; text-align: right; }
  .erreur { margin: 0.7rem 0 0; font-size: 0.85rem; opacity: 0.85; }
</style>
