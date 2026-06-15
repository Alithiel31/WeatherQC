<script lang="ts">
  import { iconeMeteo, heureCourte, jourCourt } from './meteo.ts';
  import type { PrevisionsHoraires } from './types.ts';

  interface Props {
    heures?: PrevisionsHoraires[];
  }

  const { heures = [] }: Props = $props();

  function etiquette(h: PrevisionsHoraires, i: number): string {
    if (i === 0) return 'Maint.';
    const heure = new Date(h.heure).getHours();
    if (heure === 0) return jourCourt(h.heure.slice(0, 10));
    return heureCourte(h.heure);
  }
</script>

<section aria-label="Prévisions horaires">
  <h2>Heure par heure — 48 h</h2>
  <ul>
    {#each heures as h, i}
      <li class:minuit={i > 0 && new Date(h.heure).getHours() === 0}>
        <span class="heure">{etiquette(h, i)}</span>
        <span class="icone" aria-hidden="true">{iconeMeteo(h.code)}</span>
        <span class="temp">{Math.round(h.temperature)}°</span>
        {#if h.precipitation >= 20}
          <span class="pluie">{h.precipitation} %</span>
        {/if}
      </li>
    {/each}
  </ul>
</section>

<style>
  section {
    background: rgba(255,255,255,0.12); border-radius: 1rem;
    padding: 1rem 0 0.75rem; backdrop-filter: blur(6px);
  }
  h2 {
    margin: 0 1rem 0.6rem; font-size: 0.75rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.75;
  }
  ul {
    display: flex; gap: 0.4rem; overflow-x: auto;
    padding: 0 1rem 0.5rem; margin: 0; list-style: none; scrollbar-width: thin;
  }
  li {
    display: flex; flex-direction: column; align-items: center;
    gap: 0.3rem; min-width: 3.4rem; font-variant-numeric: tabular-nums;
  }
  .heure { font-size: 0.72rem; opacity: 0.75; white-space: nowrap; }
  .icone { font-size: 1.3rem; }
  .temp  { font-weight: 600; }
  .pluie { font-size: 0.68rem; color: #bfe3ff; }
  .minuit { border-left: 1px solid rgba(255,255,255,0.35); padding-left: 0.5rem; }
  .minuit .heure { font-weight: 700; opacity: 1; }
</style>
