<script lang="ts">
  import './styles/verre.css';

  /**
   * Navigation basse : quatre ancres vers des sections de l'unique page (pas
   * de router, pas d'écrans séparés) — Accueil, Carte, Favoris et Réglages
   * portent maintenant chacune une vraie fonctionnalité, contrairement à la
   * première version de cette refonte qui n'en gardait que deux faute
   * d'équivalent réel pour les deux autres.
   */
  type Section = 'accueil' | 'carte' | 'favoris' | 'reglages';

  interface Props {
    actif: Section;
    onnaviguer: (section: Section) => void;
  }

  const { actif, onnaviguer }: Props = $props();

  const onglets: Array<{ id: Section; libelle: string }> = [
    { id: 'accueil', libelle: 'Accueil' },
    { id: 'carte', libelle: 'Carte' },
    { id: 'favoris', libelle: 'Favoris' },
    { id: 'reglages', libelle: 'Réglages' },
  ];
</script>

<nav class="bas carte-verre" aria-label="Navigation">
  {#each onglets as onglet (onglet.id)}
    <button
      type="button"
      class:actif={actif === onglet.id}
      aria-current={actif === onglet.id}
      onclick={() => onnaviguer(onglet.id)}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        {#if onglet.id === 'accueil'}
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 9.5V20h13V9.5" />
        {:else if onglet.id === 'carte'}
          <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
          <path d="M9 4v13" />
          <path d="M15 6.5v13" />
        {:else if onglet.id === 'favoris'}
          <path d="M12 3.5 14.7 9l6 .9-4.35 4.15L17.4 20 12 17l-5.4 3 1.05-5.95L3.3 9.9l6-.9 2.7-5.5Z" />
        {:else}
          <circle cx="12" cy="12" r="3" />
          <path d="M19 12a7 7 0 0 0-.13-1.32l1.8-1.4-1.8-3.12-2.13.72a7 7 0 0 0-2.28-1.32L14.1 3.2h-3.6l-.36 2.36a7 7 0 0 0-2.28 1.32l-2.13-.72-1.8 3.12 1.8 1.4a7 7 0 0 0 0 2.64l-1.8 1.4 1.8 3.12 2.13-.72a7 7 0 0 0 2.28 1.32l.36 2.36h3.6l.36-2.36a7 7 0 0 0 2.28-1.32l2.13.72 1.8-3.12-1.8-1.4c.08-.43.13-.87.13-1.32Z" />
        {/if}
      </svg>
      <span>{onglet.libelle}</span>
    </button>
  {/each}
</nav>

<style>
  .bas {
    position: fixed;
    left: 0.75rem;
    right: 0.75rem;
    bottom: max(env(safe-area-inset-bottom), 0.6rem);
    z-index: 20;
    display: flex;
    gap: 0.15rem;
    padding: 0.4rem;
    max-width: 26rem;
    margin: 0 auto;
    background: var(--verre-fond-fort);
  }

  button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.2rem;
    border: 0;
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
    font: inherit;
    font-size: 0.65rem;
    font-weight: 600;
    padding: 0.5rem 0.3rem 0.45rem;
    border-radius: calc(var(--rayon-carte) - 0.4rem);
    cursor: pointer;
    transition: color 0.15s ease, background-color 0.15s ease;
  }
  button.actif {
    color: #fff;
    background: rgba(77, 163, 255, 0.16);
  }
  button.actif svg { color: var(--accent-doux); }
  button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

  @media (prefers-reduced-motion: reduce) {
    button { transition: none; }
  }
</style>
