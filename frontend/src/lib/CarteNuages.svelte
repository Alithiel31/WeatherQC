<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import L from 'leaflet';
  import 'leaflet/dist/leaflet.css';
  import { framesRainViewer, HOTE_TUILES_DEFAUT } from './api.ts';
  import { heureMinute } from './meteo.ts';
  import { creerAnimation } from './animationFrames.svelte.ts';
  import type { ImageRainViewer, FramesRainViewer } from './types.ts';

  interface Props {
    latitude: number;
    longitude: number;
    nom?: string;
  }

  const { latitude, longitude, nom = '' }: Props = $props();

  // Leaflet objects — $state.raw() to avoid deep proxy wrapping
  let conteneur = $state.raw<HTMLDivElement | undefined>(undefined);
  let carte     = $state.raw<L.Map | undefined>(undefined);
  let marqueur  = $state.raw<L.CircleMarker | undefined>(undefined);
  let couches   = $state.raw<L.TileLayer[]>([]);

  let mode          = $state<'satellite' | 'radar'>('satellite');
  let hote          = $state(HOTE_TUILES_DEFAUT);
  let donneesFrames = $state<FramesRainViewer | null>(null);
  let erreurCarte   = $state(false);
  let minuterieRafraichissement: ReturnType<typeof setInterval> | null = null;

  // Le défilement vit dans son propre module ; ici on ne garde que ce qui touche
  // à Leaflet — rendre visible la couche correspondant à l'image demandée.
  const animation = creerAnimation((i) =>
    couches.forEach((c, j) => c.setOpacity(j === i ? 0.75 : 0))
  );

  // Sert deux fois : à l'affichage, et comme `aria-valuetext` du curseur.
  let heureAnimation = $derived(
    animation.frames[animation.index]
      ? heureMinute(animation.frames[animation.index].time * 1000)
      : ''
  );

  const reduireMouvement =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  function urlTuile(frame: ImageRainViewer): string {
    return mode === 'satellite'
      ? `${hote}${frame.path}/256/{z}/{x}/{y}/0/0_0.png`
      : `${hote}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;
  }

  function viderCouches(): void {
    couches.forEach((c) => carte?.removeLayer(c));
    couches = [];
  }

  function construireCouches(): void {
    if (!carte) return;
    viderCouches();
    couches = animation.frames.map((f) =>
      L.tileLayer(urlTuile(f), { opacity: 0, tileSize: 256, zIndex: 400 }).addTo(carte!)
    );
    animation.allerA(animation.frames.length - 1);
  }

  function changerMode(nouveau: 'satellite' | 'radar'): void {
    if (mode === nouveau || !donneesFrames) return;
    mode = nouveau;
    animation.remplacer(
      mode === 'satellite' ? donneesFrames.satellite : donneesFrames.radar
    );
    construireCouches();
  }

  async function rafraichirFrames(): Promise<void> {
    try {
      await chargerFrames();
      construireCouches();
    } catch {
      // silencieux — on garde les frames existantes
    }
  }

  /**
   * `premierChargement` distingue l'initialisation du rafraîchissement.
   *
   * Le mode était réaffecté sans condition, et `rafraichirFrames` appelle cette
   * fonction toutes les 10 minutes : un utilisateur en train de regarder le
   * radar était ramené sur « Nuages » en pleine session, sans avoir rien fait.
   * Un rafraîchissement conserve donc le choix, et ne bascule que si la série
   * retenue est revenue vide.
   */
  async function chargerFrames(premierChargement = false): Promise<void> {
    donneesFrames = await framesRainViewer(hote);
    hote = donneesFrames.hote;

    const serie = (m: 'satellite' | 'radar') =>
      m === 'satellite' ? donneesFrames!.satellite : donneesFrames!.radar;

    if (premierChargement || serie(mode).length === 0) {
      mode = donneesFrames.satellite.length === 0 ? 'radar' : 'satellite';
    }

    animation.remplacer(serie(mode));
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
      await chargerFrames(true);
      construireCouches();
      if (!reduireMouvement) animation.basculerLecture();
      minuterieRafraichissement = setInterval(rafraichirFrames, 10 * 60 * 1000);
    } catch {
      erreurCarte = true;
    }
  });

  onDestroy(() => {
    animation.detruire();
    if (minuterieRafraichissement) clearInterval(minuterieRafraichissement);
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
  {:else if animation.frames.length}
    <div class="controles">
      <button
        class="lecture"
        onclick={() => animation.basculerLecture()}
        aria-label={animation.lecture ? 'Mettre en pause' : "Lancer l'animation"}
      >{animation.lecture ? '⏸' : '▶'}</button>
      <!--
        Sans `aria-valuetext`, le curseur s'annonce « 5 sur 13 » — un index brut,
        sans signification. L'horodatage est déjà calculé pour l'affichage juste
        à côté : c'est lui qu'il faut dire.
      -->
      <input
        type="range"
        min="0"
        max={animation.frames.length - 1}
        value={animation.index}
        oninput={(e) => animation.deplacerVers(Number(e.currentTarget.value))}
        aria-label="Position dans l'animation"
        aria-valuetext={heureAnimation}
      />
      <span class="heure">{heureAnimation}</span>
    </div>
  {/if}
</section>

<style>
  /* Même voile que `Horaire` et `Quotidien` : cf. le commentaire qui s'y trouve. */
  section {
    background: rgba(0,0,0,0.2); border-radius: 1rem;
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
