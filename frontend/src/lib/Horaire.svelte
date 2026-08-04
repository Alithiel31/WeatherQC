<script lang="ts">
  import { iconeMeteo, descriptionMeteo, degres, heureCourte, jourCourt } from './meteo.ts';
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
  <!--
    `overflow-x: auto` sans `tabindex` : un conteneur défilant n'est focusable par
    aucun moyen au clavier, donc tout ce qui dépasse la sixième heure était hors
    d'atteinte. Rendu focusable, le navigateur prend en charge les flèches.

    Le rôle et le `tabindex` vont sur un conteneur, pas sur le `<ul>` : les poser
    sur la liste elle-même remplace son `role="list"`, et ses `<li>` deviennent
    des éléments de liste orphelins — axe le signale en `serious`. La liste reste
    donc une liste, et c'est son enveloppe qui défile.

    La règle du compilateur refuse `tabindex` sur un élément non interactif, et
    elle a raison dans le cas général. L'exception est le critère WCAG 2.1.1
    appliqué aux régions défilantes : rendre les 48 `li` focusables serait pire.
  -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="bande" tabindex="0" role="group" aria-label="48 heures à venir, liste défilante">
    <ul>
      {#each heures as h, i (h.heure)}
        <li class:minuit={i > 0 && new Date(h.heure).getHours() === 0}>
          <span class="heure">{etiquette(h, i)}</span>
          <!--
            L'icône portait `aria-hidden` sans équivalent textuel : un lecteur
            d'écran entendait « 14 h 12° 30 % » sans jamais apprendre s'il pleut.
            `Quotidien` donnait déjà la condition — même traitement ici.
          -->
          <span class="icone" role="img" aria-label={descriptionMeteo(h.code)}
            >{iconeMeteo(h.code)}</span
          >
          <span class="temp">{degres(h.temperature)}</span>
          {#if h.precipitation !== null && h.precipitation >= 20}
            <span class="pluie">{h.precipitation} %</span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
</section>

<style>
  /*
    Voile sombre plutôt que blanc à 12 % : par-dessus le voile de page, un voile
    clair éclaircit le fond au lieu de l'assombrir et fait retomber le blanc à
    3.95:1. À 0.2 le pire cas (neige) donne 7.01:1 en blanc et 5.22:1 pour
    `.pluie` — les couleurs et opacités d'origine tiennent donc telles quelles.
    `tests/unit/contraste.test.ts` relit ces valeurs et refait le calcul.
  */
  section {
    background: rgba(0,0,0,0.2); border-radius: 1rem;
    padding: 1rem 0 0.75rem; backdrop-filter: blur(6px);
  }
  h2 {
    margin: 0 1rem 0.6rem; font-size: 0.75rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.12em; opacity: 0.75;
  }
  .bande { overflow-x: auto; scrollbar-width: thin; }
  .bande:focus-visible { outline: 2px solid #fff; outline-offset: -2px; border-radius: 0.5rem; }
  ul {
    display: flex; gap: 0.4rem;
    padding: 0 1rem 0.5rem; margin: 0; list-style: none;
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
