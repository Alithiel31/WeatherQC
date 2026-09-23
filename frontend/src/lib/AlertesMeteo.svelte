<script lang="ts">
  import { onMount } from 'svelte';
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
  <div class="alertes-meteo">
    {#if abonneIci}
      <p class="etat">Alertes météo activées pour {villeNom}</p>
      <button type="button" class="bascule" onclick={desactiver} disabled={enCours}>
        {enCours ? 'Désactivation…' : 'Désactiver'}
      </button>
    {:else}
      <button type="button" class="bascule" onclick={activer} disabled={enCours}>
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
    padding: 0.5rem 0.9rem;
    background: rgba(0, 0, 0, 0.25);
    border-radius: 0.6rem;
    font-size: 0.85rem;
    backdrop-filter: blur(6px);
  }

  .etat { margin: 0; flex: 1 1 auto; }

  .bascule {
    flex-shrink: 0;
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
