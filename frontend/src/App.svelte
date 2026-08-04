<script lang="ts">
  import { onMount } from 'svelte';
  import Horaire from './lib/Horaire.svelte';
  import Quotidien from './lib/Quotidien.svelte';
  import CarteNuages from './lib/CarteNuages.svelte';
  import ConditionsActuelles from './lib/ConditionsActuelles.svelte';
  import RechercheCodePostal from './lib/RechercheCodePostal.svelte';
  import { familleMeteo, heureMinute } from './lib/meteo.ts';
  import {
    previsionsVille,
    previsionsCoordonnees,
    geocoder,
    villesDisponibles,
    VILLES_REPLI,
    ErreurApi,
  } from './lib/api.ts';
  import { creerPreferences } from './lib/preferences.svelte.ts';
  import type { ReponseMeteo, VilleDisponible } from './lib/types.ts';

  const prefs = creerPreferences();

  // `VILLES_REPLI` le temps que `/api/villes` réponde — et indéfiniment si le
  // backend est injoignable : le sélecteur doit exister au premier rendu.
  let villes     = $state<VilleDisponible[]>(VILLES_REPLI);
  let donnees    = $state<ReponseMeteo | null>(null);
  let chargement = $state(true);
  let erreur     = $state<string | null>(null);
  let erreurCP   = $state<string | null>(null);
  let rechercheCP = $state(false);
  let horsLigne  = $state(!navigator.onLine);

  let famille   = $derived(donnees ? familleMeteo(donnees.actuel.code) : 'nuageux');
  let nuit      = $derived(donnees ? !donnees.actuel.jour : false);
  let classeCiel = $derived(`ciel ${famille}${nuit ? ' nuit' : ''}`);
  // Figé au moment où les données arrivent, et non dérivé des préférences :
  // celles-ci changent dès le clic, alors que `donnees` peut rester sur la ville
  // précédente si le chargement échoue. Dérivé, le libellé annonçait alors une
  // ville dont on affichait les prévisions d'une autre.
  let nomLieu   = $state('');

  let chargementEnCours: AbortController | null = null;
  let rechercheEnCours: AbortController | null = null;

  async function charger(): Promise<void> {
    // Deux clics rapides lançaient deux requêtes concurrentes : si la première
    // répondait en dernier, l'écran affichait une ville et le bouton actif en
    // désignait une autre. La requête devenue inutile est annulée pour de bon.
    chargementEnCours?.abort();
    const controleur = new AbortController();
    chargementEnCours = controleur;

    // Cible et libellé capturés avec la requête : ils ne bougeront plus, même si
    // l'utilisateur reclique pendant qu'elle est en vol.
    const lieu = prefs.selection === 'cp' && prefs.lieuCP ? prefs.lieuCP : null;
    const etiquette = lieu
      ? `${lieu.nom} (${lieu.rta})`
      : (villes.find((v) => v.id === prefs.selection)?.nom ?? '');

    chargement = true;
    erreur = null;
    try {
      donnees = lieu
        ? await previsionsCoordonnees(lieu, controleur.signal)
        : await previsionsVille(prefs.selection, controleur.signal);
      nomLieu = etiquette;
    } catch (e) {
      // Remplacée par une requête plus récente : ni erreur, ni fin de chargement
      // — celle qui l'a supplantée s'en charge.
      if (controleur.signal.aborted) return;

      // Le backend sait pourquoi il a échoué (ville inconnue, amont injoignable,
      // quota dépassé) ; le message générique ne sert que pour une panne réseau.
      erreur =
        e instanceof ErreurApi
          ? e.message
          : 'Les prévisions ne sont pas disponibles pour le moment. Vérifiez la connexion, puis réessayez.';
    } finally {
      // Une requête supplantée ne rend pas la main : celle qui l'a remplacée est
      // encore en vol, le spinner doit rester.
      if (chargementEnCours === controleur) chargement = false;
    }
  }

  function choisirVille(id: string): void {
    if (id === prefs.selection) return;
    // L'erreur de code postal précédente n'a plus de rapport avec ce qui est
    // affiché : la laisser à l'écran à côté d'une ville chargée est trompeur.
    erreurCP = null;
    prefs.choisirVille(id);
    charger();
  }

  async function rechercherCP(saisie: string): Promise<void> {
    // Même raisonnement que `charger()` : sans annulation, deux soumissions
    // rapides laissaient la dernière réponse gagner, et `retenirLieu` persistait
    // la saisie de la fermeture périmée — `codePostal` et `lieuCP` pouvaient
    // alors décrire deux codes différents.
    rechercheEnCours?.abort();
    const controleur = new AbortController();
    rechercheEnCours = controleur;

    erreurCP = null;
    rechercheCP = true;
    try {
      prefs.retenirLieu(await geocoder(saisie, controleur.signal), saisie);
      charger();
    } catch (e) {
      if (controleur.signal.aborted) return;
      erreurCP =
        e instanceof ErreurApi ? e.message : 'Recherche impossible. Vérifiez la connexion.';
    } finally {
      if (rechercheEnCours === controleur) rechercheCP = false;
    }
  }

  onMount(() => {
    charger();
    // Échec silencieux : `VILLES_REPLI` couvre déjà le sélecteur.
    villesDisponibles()
      .then((liste) => {
        if (liste.length) villes = liste;
      })
      .catch(() => {});

    const enLigne      = () => { horsLigne = false; charger(); };
    const horsConnexion = () => { horsLigne = true; };
    window.addEventListener('online', enLigne);
    window.addEventListener('offline', horsConnexion);
    return () => {
      window.removeEventListener('online', enLigne);
      window.removeEventListener('offline', horsConnexion);
      chargementEnCours?.abort();
      rechercheEnCours?.abort();
    };
  });
</script>

<main class={classeCiel}>
  <header>
    <p class="eyebrow">Prévisions · Canada</p>
    <nav class="villes" aria-label="Choix de la ville">
      {#each villes as v (v.id)}
        <button
          class:active={v.id === prefs.selection}
          onclick={() => choisirVille(v.id)}
          aria-pressed={v.id === prefs.selection}
        >{v.nom}</button>
      {/each}
      {#if prefs.lieuCP}
        <button
          class:active={prefs.selection === 'cp'}
          onclick={() => choisirVille('cp')}
          aria-pressed={prefs.selection === 'cp'}
        >{prefs.lieuCP.rta}</button>
      {/if}
    </nav>

    <RechercheCodePostal
      bind:valeur={prefs.codePostal}
      erreur={erreurCP}
      enCours={rechercheCP}
      onrechercher={rechercherCP}
    />
  </header>

  {#if horsLigne}
    <p class="bandeau-hors-ligne">Hors ligne — dernières prévisions enregistrées</p>
  {/if}

  <!--
    Une erreur survenue alors qu'on a encore des prévisions valides devient un
    bandeau, pas un écran plein : l'ordre des branches faisait disparaître des
    données parfaitement lisibles, toujours présentes en mémoire — l'inverse de
    ce que promet une application hors ligne d'abord.
  -->
  {#if erreur && donnees && !chargement}
    <div class="bandeau-erreur" role="alert">
      <p>{erreur}</p>
      <button class="reessayer" onclick={charger}>Réessayer</button>
    </div>
  {/if}

  {#if chargement}
    <div class="etat">
      <span class="spinner" aria-hidden="true"></span>
      <p>Chargement des prévisions…</p>
    </div>
  {:else if erreur && !donnees}
    <div class="etat erreur" role="alert">
      <p>{erreur}</p>
      <button class="reessayer" onclick={charger}>Réessayer</button>
    </div>
  {:else if donnees}
    <ConditionsActuelles actuel={donnees.actuel} lieu={nomLieu} />

    <Horaire heures={donnees.horaire} />

    {#if !horsLigne}
      <CarteNuages
        latitude={donnees.ville.latitude}
        longitude={donnees.ville.longitude}
        nom={donnees.ville.nom}
      />
    {/if}

    <Quotidien jours={donnees.quotidien} />

    <footer>
      <p>
        Mis à jour à {heureMinute(donnees.misAJour)} · Données
        <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>
      </p>
    </footer>
  {/if}
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: #10243b;
  }

  main {
    min-height: 100dvh;
    color: #fff;
    padding: max(env(safe-area-inset-top), 1.25rem) 1.25rem 2rem;
    max-width: 32rem;
    margin: 0 auto;
    transition: background 0.8s ease;
  }

  .ciel.degage       { background: linear-gradient(180deg, #1f6fc4 0%, #7fc2ee 130%); }
  .ciel.degage.nuit  { background: linear-gradient(180deg, #081226 0%, #1d3a61 130%); }
  .ciel.nuageux      { background: linear-gradient(180deg, #4a5d72 0%, #8da1b4 130%); }
  .ciel.nuageux.nuit { background: linear-gradient(180deg, #1a2531 0%, #3c4d5f 130%); }
  .ciel.pluie, .ciel.pluie.nuit { background: linear-gradient(180deg, #2e3d4e 0%, #5d7186 130%); }
  .ciel.neige        { background: linear-gradient(180deg, #5b7493 0%, #b9cce0 140%); }
  .ciel.neige.nuit   { background: linear-gradient(180deg, #232f42 0%, #5b7493 140%); }
  .ciel.orage, .ciel.orage.nuit { background: linear-gradient(180deg, #141c29 0%, #3d4d63 130%); }
  .ciel.brouillard, .ciel.brouillard.nuit { background: linear-gradient(180deg, #6c7b89 0%, #aab6c1 140%); }

  header { display: flex; flex-direction: column; gap: 0.75rem; }
  .eyebrow { margin: 0; font-size: 0.75rem; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.75; }

  .villes {
    display: inline-flex; gap: 0.25rem;
    background: rgba(255,255,255,0.14); border-radius: 999px;
    padding: 0.25rem; width: fit-content; backdrop-filter: blur(6px);
  }
  .villes button {
    border: 0; background: transparent; color: #fff; font: inherit;
    font-weight: 600; padding: 0.45rem 1.1rem; border-radius: 999px; cursor: pointer;
  }
  .villes button.active { background: #fff; color: #16314d; }
  .villes button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

  .bandeau-hors-ligne {
    margin: 1rem 0 0; padding: 0.5rem 0.9rem;
    background: rgba(0,0,0,0.3); border-radius: 0.6rem; font-size: 0.85rem;
  }

  .bandeau-erreur {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.75rem; flex-wrap: wrap;
    margin: 1rem 0 0; padding: 0.6rem 0.9rem;
    background: rgba(120,20,20,0.45); border-radius: 0.6rem; font-size: 0.85rem;
  }
  .bandeau-erreur p { margin: 0; }
  .bandeau-erreur .reessayer { padding: 0.35rem 0.9rem; font-size: 0.85rem; }

  .etat { text-align: center; padding: 4rem 1rem; }
  .spinner {
    display: inline-block; width: 2rem; height: 2rem;
    border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff;
    border-radius: 50%; animation: tourner 0.9s linear infinite;
  }
  @keyframes tourner { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .spinner { animation: none; }
    main { transition: none; }
  }
  .reessayer {
    border: 1px solid rgba(255,255,255,0.5); background: transparent; color: #fff;
    font: inherit; padding: 0.5rem 1.25rem; border-radius: 999px; cursor: pointer;
  }

  footer { margin-top: 1.75rem; text-align: center; font-size: 0.8rem; opacity: 0.7; }
  footer a { color: inherit; }
</style>
