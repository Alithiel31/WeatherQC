<script lang="ts">
  import { onMount } from 'svelte';
  import Horaire from './lib/Horaire.svelte';
  import Quotidien from './lib/Quotidien.svelte';
  import CarteNuages from './lib/CarteNuages.svelte';
  import { descriptionMeteo, iconeMeteo, familleMeteo, heureMinute } from './lib/meteo.ts';
  import type { ReponseMeteo, LieuCP } from './lib/types.ts';
  import { API_URL } from './lib/api.ts';

  const villes = [
    { id: 'montreal', nom: 'Montréal' },
    { id: 'quebec', nom: 'Québec' },
  ] as const;

  let selection  = $state<string>(localStorage.getItem('selection') ?? 'montreal');
  let codePostal = $state<string>(localStorage.getItem('codePostal') ?? '');
  let lieuCP     = $state<LieuCP | null>(JSON.parse(localStorage.getItem('lieuCP') ?? 'null'));
  let donnees    = $state<ReponseMeteo | null>(null);
  let chargement = $state(true);
  let erreur     = $state<string | null>(null);
  let erreurCP   = $state<string | null>(null);
  let horsLigne  = $state(!navigator.onLine);

  let famille   = $derived(donnees ? familleMeteo(donnees.actuel.code) : 'nuageux');
  let nuit      = $derived(donnees ? !donnees.actuel.jour : false);
  let classeCiel = $derived(`ciel ${famille}${nuit ? ' nuit' : ''}`);
  let nomLieu   = $derived(
    selection === 'cp' && lieuCP
      ? `${lieuCP.nom} (${lieuCP.rta})`
      : (villes.find((v) => v.id === selection)?.nom ?? '')
  );

  async function charger(): Promise<void> {
    chargement = true;
    erreur = null;
    try {
      let url: string;
      if (selection === 'cp' && lieuCP) {
        const q = new URLSearchParams({
          lat: String(lieuCP.latitude),
          lon: String(lieuCP.longitude),
          nom: lieuCP.nom,
        });
        url = `${API_URL}/api/previsions-coordonnees?${q}`;
      } else {
        url = `${API_URL}/api/previsions/${selection}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Réponse invalide du serveur');
      donnees = (await res.json()) as ReponseMeteo;
    } catch {
      erreur = 'Les prévisions ne sont pas disponibles pour le moment. Vérifiez la connexion, puis réessayez.';
    } finally {
      chargement = false;
    }
  }

  function choisirVille(id: string): void {
    if (id === selection) return;
    selection = id;
    localStorage.setItem('selection', id);
    charger();
  }

  async function rechercherCP(): Promise<void> {
    erreurCP = null;
    const saisie = codePostal.trim();
    if (!saisie) return;
    try {
      const res = await fetch(`${API_URL}/api/geocode/${encodeURIComponent(saisie)}`);
      const data = (await res.json()) as LieuCP & { erreur?: string };
      if (!res.ok) {
        erreurCP = data.erreur ?? 'Code postal introuvable.';
        return;
      }
      lieuCP = data;
      selection = 'cp';
      localStorage.setItem('selection', 'cp');
      localStorage.setItem('codePostal', saisie);
      localStorage.setItem('lieuCP', JSON.stringify(data));
      charger();
    } catch {
      erreurCP = 'Recherche impossible. Vérifiez la connexion.';
    }
  }

  onMount(() => {
    charger();
    const enLigne      = () => { horsLigne = false; charger(); };
    const horsConnexion = () => { horsLigne = true; };
    window.addEventListener('online', enLigne);
    window.addEventListener('offline', horsConnexion);
    return () => {
      window.removeEventListener('online', enLigne);
      window.removeEventListener('offline', horsConnexion);
    };
  });
</script>

<main class={classeCiel}>
  <header>
    <p class="eyebrow">Prévisions · Canada</p>
    <nav class="villes" aria-label="Choix de la ville">
      {#each villes as v}
        <button
          class:active={v.id === selection}
          onclick={() => choisirVille(v.id)}
          aria-pressed={v.id === selection}
        >{v.nom}</button>
      {/each}
      {#if lieuCP}
        <button
          class:active={selection === 'cp'}
          onclick={() => choisirVille('cp')}
          aria-pressed={selection === 'cp'}
        >{lieuCP.rta}</button>
      {/if}
    </nav>

    <div class="recherche-cp">
      <label class="visually-hidden" for="cp">Code postal canadien</label>
      <input
        id="cp"
        type="text"
        placeholder="Code postal (ex. K1A 0B1)"
        bind:value={codePostal}
        onkeydown={(e) => e.key === 'Enter' && rechercherCP()}
        autocomplete="postal-code"
        maxlength="7"
      />
      <button onclick={rechercherCP}>Rechercher</button>
    </div>
    {#if erreurCP}
      <p class="erreur-cp" role="alert">{erreurCP}</p>
    {/if}
  </header>

  {#if horsLigne}
    <p class="bandeau-hors-ligne">Hors ligne — dernières prévisions enregistrées</p>
  {/if}

  {#if chargement}
    <div class="etat">
      <span class="spinner" aria-hidden="true"></span>
      <p>Chargement des prévisions…</p>
    </div>
  {:else if erreur}
    <div class="etat erreur" role="alert">
      <p>{erreur}</p>
      <button class="reessayer" onclick={charger}>Réessayer</button>
    </div>
  {:else if donnees}
    <section class="actuel" aria-label="Conditions actuelles">
      <p class="lieu">{nomLieu}</p>
      <span class="icone" aria-hidden="true">{iconeMeteo(donnees.actuel.code, donnees.actuel.jour)}</span>
      <p class="temperature">{Math.round(donnees.actuel.temperature)}<sup>°C</sup></p>
      <p class="condition">{descriptionMeteo(donnees.actuel.code)}</p>
      <dl class="details">
        <div><dt>Ressenti</dt><dd>{Math.round(donnees.actuel.ressenti)}°</dd></div>
        <div><dt>Vent</dt><dd>{Math.round(donnees.actuel.vent)} km/h</dd></div>
        <div><dt>Humidité</dt><dd>{donnees.actuel.humidite} %</dd></div>
      </dl>
    </section>

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

  .recherche-cp { display: flex; gap: 0.4rem; }
  .recherche-cp input {
    flex: 1; min-width: 0; border: 0; border-radius: 0.6rem;
    padding: 0.55rem 0.8rem; font: inherit;
    background: rgba(255,255,255,0.16); color: #fff; backdrop-filter: blur(6px);
  }
  .recherche-cp input::placeholder { color: rgba(255,255,255,0.65); }
  .recherche-cp input:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
  .recherche-cp button {
    border: 0; border-radius: 0.6rem; padding: 0.55rem 0.95rem;
    font: inherit; font-weight: 600; background: rgba(255,255,255,0.9); color: #16314d; cursor: pointer;
  }
  .recherche-cp button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .erreur-cp {
    margin: 0; font-size: 0.85rem;
    background: rgba(0,0,0,0.3); padding: 0.45rem 0.8rem; border-radius: 0.6rem;
  }

  .visually-hidden {
    position: absolute; width: 1px; height: 1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
  }

  .bandeau-hors-ligne {
    margin: 1rem 0 0; padding: 0.5rem 0.9rem;
    background: rgba(0,0,0,0.3); border-radius: 0.6rem; font-size: 0.85rem;
  }

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

  footer { margin-top: 1.75rem; text-align: center; font-size: 0.8rem; opacity: 0.7; }
  footer a { color: inherit; }
</style>
