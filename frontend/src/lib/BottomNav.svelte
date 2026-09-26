<script lang="ts">
  import './styles/verre.css';

  /**
   * Navigation basse purement visuelle : deux ancres vers des sections déjà
   * présentes sur l'unique page (pas de router, pas d'écrans séparés). Le
   * troisième et quatrième onglet de la référence visuelle — Favoris,
   * Réglages — n'ont pas d'équivalent réel dans l'application (pas de villes
   * favorites, pas de page réglages séparée) et ont donc été volontairement
   * omis plutôt que simulés.
   */
  interface Props {
    actif: 'accueil' | 'carte';
    onnaviguer: (section: 'accueil' | 'carte') => void;
  }

  const { actif, onnaviguer }: Props = $props();
</script>

<nav class="bas carte-verre" aria-label="Navigation">
  <button
    type="button"
    class:actif={actif === 'accueil'}
    aria-current={actif === 'accueil'}
    onclick={() => onnaviguer('accueil')}
  >
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 9.5V20h13V9.5" />
    </svg>
    <span>Accueil</span>
  </button>
  <button
    type="button"
    class:actif={actif === 'carte'}
    aria-current={actif === 'carte'}
    onclick={() => onnaviguer('carte')}
  >
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5 9 4Z" />
      <path d="M9 4v13" />
      <path d="M15 6.5v13" />
    </svg>
    <span>Carte</span>
  </button>
</nav>

<style>
  .bas {
    position: fixed;
    left: 0.75rem;
    right: 0.75rem;
    bottom: max(env(safe-area-inset-bottom), 0.6rem);
    z-index: 20;
    display: flex;
    gap: 0.25rem;
    padding: 0.4rem;
    max-width: 24rem;
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
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.5rem 0.5rem 0.45rem;
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
