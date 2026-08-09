<script lang="ts">
  import type { VilleDisponible, LieuCP } from './types.ts';

  interface Props {
    villes: VilleDisponible[];
    lieuCP: LieuCP | null;
    selection: string;
    onchoisir: (id: string) => void;
  }

  let { villes, lieuCP, selection, onchoisir }: Props = $props();

  let ouvert = $state(false);
  // `bind:this` doit cibler du `$state` en Svelte 5 : sans quoi le `$effect`
  // ci-dessous — qui lit `panneau` pour poser le focus à l'ouverture — ne
  // réagit pas de façon fiable à son assignation.
  let racine: HTMLDivElement = $state()!;
  let declencheur: HTMLButtonElement = $state()!;
  let panneau: HTMLUListElement = $state()!;

  // Remplace l'ancien ruban à défilement horizontal : le bouton n'affiche plus
  // que la ville active, la liste complète vit dans un panneau qui ne s'ouvre
  // qu'à la demande.
  let libelleActif = $derived(
    selection === 'cp' && lieuCP
      ? lieuCP.rta
      : (villes.find((v) => v.id === selection)?.nom ?? '')
  );

  function basculer(): void {
    ouvert = !ouvert;
  }

  function choisir(id: string): void {
    ouvert = false;
    declencheur?.focus();
    onchoisir(id);
  }

  // `contains` plutôt que comparer les cibles : un clic sur le déclencheur
  // bulle jusqu'ici aussi, mais il est toujours dans `racine`, donc jamais
  // traité comme un clic extérieur.
  function surClicExterieur(e: MouseEvent): void {
    if (ouvert && racine && !racine.contains(e.target as Node)) ouvert = false;
  }

  function surEchapGlobal(e: KeyboardEvent): void {
    if (e.key === 'Escape' && ouvert) {
      ouvert = false;
      declencheur?.focus();
    }
  }

  // Focus posé sur l'entrée active à l'ouverture : reprendre la navigation
  // clavier là où on l'a laissée, plutôt que de la faire repartir du haut.
  $effect(() => {
    if (ouvert && panneau) {
      const actif = panneau.querySelector<HTMLButtonElement>('button[aria-current="true"]');
      (actif ?? panneau.querySelector('button'))?.focus();
    }
  });

  function surClavierPanneau(e: KeyboardEvent): void {
    const items = Array.from(panneau.querySelectorAll<HTMLButtonElement>('button'));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items.at(-1)?.focus();
    }
  }
</script>

<svelte:window onclick={surClicExterieur} onkeydown={surEchapGlobal} />

<div class="selecteur-ville" bind:this={racine}>
  <!-- Purement visuelle : le bouton porte déjà tout le contexte nécessaire
       pour les lecteurs d'écran via son `aria-label`. La répéter ici les
       ferait annoncer deux fois la même information. -->
  <span class="etiquette" aria-hidden="true">Ville sélectionnée</span>

  <!-- Le panneau s'ancre à cette zone plutôt qu'à `.selecteur-ville` : sinon
       `left: 0` (du panneau) s'alignerait sous l'étiquette plutôt que sous
       le bouton. -->
  <div class="zone-declencheur">
    <button
      type="button"
      class="declencheur"
      bind:this={declencheur}
      aria-haspopup="true"
      aria-expanded={ouvert}
      aria-label={`Choisir une ville — actuellement ${libelleActif}`}
      onclick={basculer}
    >
      <span aria-hidden="true">{libelleActif}</span>
      <span class="chevron" class:ouvert aria-hidden="true">▾</span>
    </button>

    {#if ouvert}
      <ul
        class="panneau"
        role="menu"
        aria-label="Choix de la ville"
        bind:this={panneau}
        onkeydown={surClavierPanneau}
      >
        {#each villes as v (v.id)}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              class:active={v.id === selection}
              aria-current={v.id === selection}
              onclick={() => choisir(v.id)}
            >{v.nom}</button>
          </li>
        {/each}
        {#if lieuCP}
          <li role="none">
            <button
              type="button"
              role="menuitem"
              class:active={selection === 'cp'}
              aria-current={selection === 'cp'}
              onclick={() => choisir('cp')}
            >{lieuCP.rta}</button>
          </li>
        {/if}
      </ul>
    {/if}
  </div>
</div>

<style>
  .selecteur-ville {
    display: flex; align-items: center; gap: 0.5rem;
    width: fit-content; max-width: 100%;
  }

  /* Posée à nu sur le ciel, comme `.eyebrow` dans App.svelte : même règle de
     contraste, aucune opacité réduite, la hiérarchie tient par la taille et
     l'interlettrage. */
  .etiquette {
    flex-shrink: 0;
    font-size: 0.7rem; font-weight: 400; letter-spacing: 0.14em; text-transform: uppercase;
  }

  .zone-declencheur { position: relative; min-width: 0; }

  /* Étiquette + bouton côte à côte débordent sur les très petits écrans
     (ex. iPhone SE, 320px) : ils s'empilent en dessous de ce seuil plutôt
     que de pousser le bouton hors du cadre. */
  @media (max-width: 360px) {
    .selecteur-ville { flex-direction: column; align-items: flex-start; gap: 0.2rem; }
  }

  /* Même voile que l'ancien ruban de villes : cf. son historique de contraste
     dans App.svelte. */
  .declencheur {
    display: flex; align-items: center; gap: 0.4rem;
    border: 0; background: rgba(0,0,0,0.25); color: #fff; font: inherit;
    font-weight: 600; padding: 0.45rem 1.1rem; border-radius: 999px; cursor: pointer;
    backdrop-filter: blur(6px);
  }
  .declencheur:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

  .chevron { transition: transform 0.15s ease; }
  .chevron.ouvert { transform: rotate(180deg); }
  @media (prefers-reduced-motion: reduce) {
    .chevron { transition: none; }
  }

  .panneau {
    position: absolute; top: calc(100% + 0.4rem); left: 0; z-index: 10;
    display: flex; flex-direction: column; gap: 0.15rem;
    margin: 0; padding: 0.35rem;
    min-width: 12rem; max-width: min(85vw, 16rem);
    background: #16314d; border-radius: 0.9rem;
    box-shadow: 0 1rem 2.5rem rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.08);
    list-style: none;
  }
  .panneau li { margin: 0; }
  .panneau button {
    width: 100%; text-align: left;
    border: 0; background: transparent; color: #fff; font: inherit; font-weight: 600;
    padding: 0.55rem 0.8rem; border-radius: 0.6rem; cursor: pointer;
  }
  .panneau button:hover { background: rgba(255,255,255,0.1); }
  .panneau button.active { background: #fff; color: #16314d; }
  .panneau button:focus-visible { outline: 2px solid #fff; outline-offset: -2px; }
</style>
