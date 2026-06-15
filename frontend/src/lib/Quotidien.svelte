<script lang="ts">
  import { iconeMeteo, descriptionMeteo, jourCourt, jourLong } from './meteo.ts';
  import type { PrevisionsQuotidiennes } from './types.ts';

  interface Props {
    jours?: PrevisionsQuotidiennes[];
  }

  const { jours = [] }: Props = $props();

  let minSemaine = $derived(Math.min(...jours.map((j) => j.min)));
  let maxSemaine = $derived(Math.max(...jours.map((j) => j.max)));
  let plage      = $derived(Math.max(maxSemaine - minSemaine, 1));

  function pct(v: number): number {
    return ((v - minSemaine) / plage) * 100;
  }
</script>

<section aria-label="Prévisions sur 7 jours">
  <h2>Cette semaine</h2>
  <ol>
    {#each jours as j, i}
      <li>
        <span class="jour">{i === 0 ? 'Auj.' : jourCourt(j.date)}</span>
        <span
          class="icone"
          role="img"
          aria-label="{jourLong(j.date)} : {descriptionMeteo(j.code)}"
          title={descriptionMeteo(j.code)}
        >{iconeMeteo(j.code)}</span>
        <span class="pluie">{j.precipitation >= 20 ? j.precipitation + ' %' : ''}</span>
        <span class="min">{Math.round(j.min)}°</span>
        <span class="barre" aria-hidden="true">
          <span
            class="plage"
            style="left:{pct(j.min)}%; width:{pct(j.max) - pct(j.min)}%"
          ></span>
        </span>
        <span class="max">{Math.round(j.max)}°</span>
      </li>
    {/each}
  </ol>
</section>

<style>
  section {
    background: rgba(255,255,255,0.12); border-radius: 1rem;
    padding: 1rem; margin-top: 0.9rem; backdrop-filter: blur(6px);
  }
  h2 { margin: 0 0 0.5rem; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.75; }
  ol  { margin: 0; padding: 0; list-style: none; }
  li  {
    display: grid;
    grid-template-columns: 3rem 1.8rem 2.6rem 2.2rem 1fr 2.2rem;
    align-items: center; gap: 0.4rem;
    padding: 0.55rem 0; border-top: 1px solid rgba(255,255,255,0.15);
    font-variant-numeric: tabular-nums;
  }
  li:first-child { border-top: 0; }
  .jour  { font-weight: 600; text-transform: capitalize; }
  .icone { font-size: 1.2rem; text-align: center; }
  .pluie { font-size: 0.72rem; color: #bfe3ff; text-align: right; }
  .min   { text-align: right; opacity: 0.75; }
  .max   { text-align: right; font-weight: 600; }
  .barre { position: relative; height: 0.3rem; border-radius: 999px; background: rgba(0,0,0,0.25); }
  .plage {
    position: absolute; top: 0; bottom: 0; border-radius: 999px;
    background: linear-gradient(90deg, #7fd4ff, #ffd479); min-width: 0.3rem;
  }
</style>
