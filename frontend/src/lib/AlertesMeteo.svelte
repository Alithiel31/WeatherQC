<script lang="ts">
  import { onMount } from 'svelte';
  import './styles/verre.css';
  import { ErreurApi } from './api.ts';
  import {
    supportePush,
    villeAbonnee,
    abonner,
    desabonner,
    PermissionRefuseeError,
  } from './notifications.ts';

  interface Props {
    villeId: string;
    villeNom: string;
  }

  let { villeId, villeNom }: Props = $props();

  // Figé au montage : le support Push ne change pas en cours de session, et
  // `navigator`/`window` ne sont pas fiables avant l'hydratation du composant.
  const supporte = supportePush();

  let abonnementVille = $state<string | null>(null);
  let enCours = $state(false);
  let erreur = $state<string | null>(null);

  let abonneIci = $derived(abonnementVille === villeId);

  onMount(() => {
    if (!supporte) return;
    // Échec silencieux : en cas de panne, le contrôle retombe sur « Activer »,
    // ce qui reste une action valide.
    villeAbonnee()
      .then((v) => { abonnementVille = v; })
      .catch(() => {});
  });

  function messagePourErreur(e: unknown, defaut: string): string {
    return e instanceof PermissionRefuseeError || e instanceof ErreurApi ? e.message : defaut;
  }

  async function activer(): Promise<void> {
    erreur = null;
    enCours = true;
    try {
      await abonner(villeId);
      abonnementVille = villeId;
    } catch (e) {
      erreur = messagePourErreur(
        e,
        'Activation impossible pour le moment. Vérifiez la connexion, puis réessayez.'
      );
    } finally {
      enCours = false;
    }
  }

  async function desactiver(): Promise<void> {
    erreur = null;
    enCours = true;
    try {
      await desabonner();
      abonnementVille = null;
    } catch (e) {
      erreur = messagePourErreur(
        e,
        'Désactivation impossible pour le moment. Vérifiez la connexion, puis réessayez.'
      );
    } finally {
      enCours = false;
    }
  }
</script>

{#if supporte}
  <div class="alertes-meteo carte-verre">
    <svg class="cloche" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3.5a5 5 0 0 0-5 5v2.6c0 .8-.24 1.58-.68 2.24L5 15.5h14l-1.32-2.16a4 4 0 0 1-.68-2.24V8.5a5 5 0 0 0-5-5Z" />
      <path d="M9.5 18.5a2.5 2.5 0 0 0 5 0" />
    </svg>
    {#if abonneIci}
      <p class="etat">Alertes météo activées pour {villeNom}</p>
      <button type="button" class="bascule pressable" onclick={desactiver} disabled={enCours}>
        {enCours ? 'Désactivation…' : 'Désactiver'}
      </button>
    {:else}
      <p class="avis">
        Crée un abonnement technique (sans lien avec votre identité) enregistré sur nos serveurs
        pour cette ville. <a href="/privacy-policy.html#alertes-meteo">Détails</a>.
      </p>
      <button type="button" class="bascule pressable" onclick={activer} disabled={enCours}>
        {enCours ? 'Activation…' : `Activer les alertes météo pour ${villeNom}`}
      </button>
    {/if}
    {#if erreur}
      <p class="erreur" role="alert">{erreur}</p>
    {/if}
  </div>
{/if}

<style>
  .alertes-meteo {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem 0.75rem;
    margin: 0.75rem 0 0;
    padding: 0.65rem 0.95rem;
    background: rgba(0, 0, 0, 0.25);
    font-size: 0.85rem;
  }

  .cloche { flex-shrink: 0; color: var(--accent-doux, #a9d3ff); }

  .etat { margin: 0; flex: 1 1 auto; }

  .avis {
    margin: 0;
    flex-basis: 100%;
    font-size: 0.75rem;
    opacity: 0.85;
  }
  .avis a { color: inherit; }

  /*
    `flex-shrink: 0` forçait ce bouton à garder sa largeur intrinsèque même
    trop étroit pour elle : à 320px (iPhone SE), « Activer les alertes météo
    pour Montréal » dépassait le cadre de 2px — un vrai défilement horizontal
    de la page, détecté par `e2e/accessibilite.spec.ts`. `min-width: 0` lève la
    largeur minimale implicite des éléments flex, ce qui laisse le texte
    revenir à la ligne dans le bouton plutôt que de le faire déborder.
  */
  .bascule {
    min-width: 0;
    border: 1px solid rgba(255, 255, 255, 0.5);
    background: transparent;
    color: #fff;
    font: inherit;
    font-size: 0.8rem;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    cursor: pointer;
  }
  .bascule:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .bascule:disabled { opacity: 0.6; cursor: default; }

  .erreur { margin: 0; flex-basis: 100%; }
</style>
