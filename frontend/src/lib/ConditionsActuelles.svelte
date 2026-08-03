<script lang="ts">
  import { descriptionMeteo, iconeMeteo } from './meteo.ts';
  import type { ConditionsActuelles } from './types.ts';

  interface Props {
    actuel: ConditionsActuelles;
    lieu: string;
  }

  const { actuel, lieu }: Props = $props();
</script>

<section class="actuel" aria-label="Conditions actuelles">
  <p class="lieu">{lieu}</p>
  <span class="icone" aria-hidden="true">{iconeMeteo(actuel.code, actuel.jour)}</span>
  <p class="temperature">{Math.round(actuel.temperature)}<sup>°C</sup></p>
  <p class="condition">{descriptionMeteo(actuel.code)}</p>
  <dl class="details">
    <div><dt>Ressenti</dt><dd>{Math.round(actuel.ressenti)}°</dd></div>
    <div><dt>Vent</dt><dd>{Math.round(actuel.vent)} km/h</dd></div>
    <div><dt>Humidité</dt><dd>{actuel.humidite} %</dd></div>
  </dl>
</section>

<style>
  .actuel { text-align: center; padding: 1.75rem 0 1.5rem; }
  .lieu { margin: 0 0 0.4rem; font-size: 1rem; font-weight: 600; opacity: 0.9; }
  .icone { font-size: 3.25rem; line-height: 1; }
  .temperature {
    margin: 0.35rem 0 0;
    font-size: clamp(4.5rem, 22vw, 6.5rem); font-weight: 200;
    line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums;
  }
  .temperature sup { font-size: 0.35em; font-weight: 400; vertical-align: super; }
  .condition { margin: 0.4rem 0 0; font-size: 1.15rem; font-weight: 500; }

  .details { display: flex; justify-content: center; gap: 2rem; margin: 1.5rem 0 0; }
  .details dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.7; }
  .details dd { margin: 0.2rem 0 0; font-size: 1.1rem; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
