<script lang="ts">
  import './styles/verre.css';
  import type { Alerte } from './types.ts';

  interface Props {
    alertes?: Alerte[];
    /** Absent en dehors d'`App.svelte` (tests, aperçu isolé) : pas de chevron. */
    onvoirplus?: () => void;
  }

  const { alertes = [], onvoirplus }: Props = $props();

  // Les alertes importantes arrivent déjà en tête côté backend
  // (`detecteur-alertes.ts`) : la première de la liste est la plus grave.
  let premiere = $derived(alertes[0] ?? null);
</script>

{#if premiere}
  <div
    class="alerte carte-verre entree-douce"
    class:importante={premiere.importante}
    role={premiere.importante ? 'alert' : 'status'}
  >
    <svg
      class="icone"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      {#if premiere.importante}
        <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
        <path d="M12 9.5v4.2" />
        <path d="M12 17.2h.01" />
      {:else}
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5" />
        <path d="M12 8h.01" />
      {/if}
    </svg>
    <div class="texte">
      <p class="titre">{premiere.titre}</p>
      <p class="corps">{premiere.corps}</p>
    </div>
    {#if onvoirplus}
      <button
        type="button"
        class="voir-plus pressable"
        onclick={onvoirplus}
        aria-label="Gérer les alertes météo dans les réglages"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    {/if}
  </div>
{/if}

<style>
  .alerte {
    display: flex;
    align-items: flex-start;
    gap: 0.65rem;
    margin: 0.9rem 0 0;
    padding: 0.75rem 0.95rem;
    background: rgba(0, 0, 0, 0.22);
  }
  .icone { flex-shrink: 0; margin-top: 0.1rem; color: var(--accent-doux); }
  /* Bordure/icône ambrées réservées aux alertes "importantes" (verglas, orage) :
     la hiérarchie visuelle doit distinguer un simple avis d'un vrai danger. */
  .alerte.importante { border-color: rgba(255, 191, 92, 0.5); }
  .alerte.importante .icone { color: #ffbf5c; }
  .titre { margin: 0; font-weight: 700; font-size: 0.9rem; }
  .corps { margin: 0.2rem 0 0; font-size: 0.85rem; opacity: 0.9; }

  .voir-plus {
    flex-shrink: 0; align-self: center; margin-left: 0.2rem;
    border: 0; background: transparent; color: rgba(255, 255, 255, 0.7);
    padding: 0.3rem; cursor: pointer; line-height: 0;
  }
  .voir-plus:focus-visible { outline: var(--contour-focus); outline-offset: 2px; border-radius: 0.3rem; }
</style>
