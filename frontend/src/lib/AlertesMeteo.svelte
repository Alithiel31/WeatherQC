<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { ErreurApi } from './api.ts';
  import {
    supportePush,
    villeAbonnee,
    abonner,
    desabonner,
    PermissionRefuseeError,
  } from './notifications.ts';
  import type { Preferences } from './preferences.svelte.ts';
  import type { SeuilsAlerte } from './types.ts';

  /** Seuils par défaut du backend — voir `detecteur-alertes.ts#SEUILS_DEFAUT`. */
  const SEUILS_PAR_DEFAUT = { precipitationProbabilite: 70, chuteTemperature: 8, rafales: 60 };

  interface Props {
    villeId: string;
    villeNom: string;
    preferences: Preferences;
  }

  let { villeId, villeNom, preferences }: Props = $props();

  // Figé au montage : le support Push ne change pas en cours de session, et
  // `navigator`/`window` ne sont pas fiables avant l'hydratation du composant.
  const supporte = supportePush();

  let abonnementVille = $state<string | null>(null);
  let enCours = $state(false);
  let erreur = $state<string | null>(null);
  let personnalise = $state(false);
  // `untrack` : seule la valeur mémorisée *au montage* sert de point de départ
  // aux curseurs — sans lui, Svelte avertit que `preferences` (une prop) n'est
  // lu qu'une fois alors qu'il pourrait changer, ce qui n'est pas souhaité ici.
  let seuilPrecip = $state(
    untrack(() => preferences.seuilsAlerte?.precipitationProbabilite) ??
      SEUILS_PAR_DEFAUT.precipitationProbabilite
  );
  let seuilChute = $state(
    untrack(() => preferences.seuilsAlerte?.chuteTemperature) ?? SEUILS_PAR_DEFAUT.chuteTemperature
  );
  let seuilRafales = $state(
    untrack(() => preferences.seuilsAlerte?.rafales) ?? SEUILS_PAR_DEFAUT.rafales
  );

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
      if (personnalise) {
        const seuils: SeuilsAlerte = {
          precipitationProbabilite: seuilPrecip,
          chuteTemperature: seuilChute,
          rafales: seuilRafales,
        };
        await abonner(villeId, seuils);
        preferences.memoriserSeuils(seuils);
      } else {
        await abonner(villeId);
      }
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
      <p class="avis">
        Crée un abonnement technique (sans lien avec votre identité) enregistré sur nos serveurs
        pour cette ville. <a href="/privacy-policy.html#alertes-meteo">Détails</a>.
      </p>
      <details class="personnaliser" bind:open={personnalise}>
        <summary>Personnaliser les seuils</summary>
        <label>
          Pluie/neige à partir de {seuilPrecip} %
          <input
            type="range"
            min="10"
            max="100"
            step="5"
            bind:value={seuilPrecip}
            aria-label="Probabilité de précipitation"
          />
        </label>
        <label>
          Chute de température dès {seuilChute} °C
          <input
            type="range"
            min="2"
            max="20"
            step="1"
            bind:value={seuilChute}
            aria-label="Chute de température"
          />
        </label>
        <label>
          Rafales à partir de {seuilRafales} km/h
          <input
            type="range"
            min="30"
            max="120"
            step="5"
            bind:value={seuilRafales}
            aria-label="Vitesse des rafales"
          />
        </label>
      </details>
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

  .avis {
    margin: 0;
    flex-basis: 100%;
    font-size: 0.75rem;
    opacity: 0.85;
  }
  .avis a { color: inherit; }

  .personnaliser {
    flex-basis: 100%;
    font-size: 0.75rem;
  }
  .personnaliser summary { cursor: pointer; opacity: 0.85; }
  .personnaliser label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin-top: 0.5rem;
  }
  .personnaliser input[type='range'] { accent-color: #ffd479; }

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
