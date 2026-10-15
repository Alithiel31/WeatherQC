<script lang="ts">
  import { onMount } from 'svelte';
  import './lib/styles/tokens.css';
  import './lib/styles/ciel.css';
  import './lib/styles/verre.css';
  import './lib/styles/composants.css';
  import Horaire from './lib/Horaire.svelte';
  import Quotidien from './lib/Quotidien.svelte';
  import CarteNuages from './lib/CarteNuages.svelte';
  import ConditionsActuelles from './lib/ConditionsActuelles.svelte';
  import RechercheCodePostal from './lib/RechercheCodePostal.svelte';
  import SelecteurVille from './lib/SelecteurVille.svelte';
  import AlertesMeteo from './lib/AlertesMeteo.svelte';
  import BandeauAlerte from './lib/BandeauAlerte.svelte';
  import Favoris from './lib/Favoris.svelte';
  import BottomNav from './lib/BottomNav.svelte';
  import { familleMeteo, heureMinute, libelleUniteTemp } from './lib/meteo.ts';
  import { creerPreferences } from './lib/preferences.svelte.ts';
  import { creerMeteoCourante } from './lib/meteoCourante.svelte.ts';
  import type { Favori } from './lib/types.ts';

  const prefs = creerPreferences();
  // Prévisions, recherche de lieu et leurs règles d'annulation : voir
  // `lib/meteoCourante.svelte.ts`. Ce composant ne garde que la mise en page
  // et la navigation.
  const meteo = creerMeteoCourante(prefs);

  let horsLigne  = $state(!navigator.onLine);

  let famille   = $derived(meteo.donnees ? familleMeteo(meteo.donnees.actuel.code) : 'nuageux');
  let nuit      = $derived(meteo.donnees ? !meteo.donnees.actuel.jour : false);
  let classeCiel = $derived(`ciel ${famille}${nuit ? ' nuit' : ''}`);

  // Pas d'abonnement par code postal (décision produit) : le nom n'est dérivé
  // que pour une ville du sélecteur, jamais pour `prefs.lieuCP`.
  let nomVilleActive = $derived(meteo.villes.find((v) => v.id === prefs.selection)?.nom ?? '');

  // Le lieu actuellement sélectionné, sous la forme que persiste `prefs.favoris`
  // — `null` si rien n'est encore résolu (ville du repli pas encore confirmée,
  // par exemple). Dérivé des préférences (pas figé comme `meteo.nomLieu`) :
  // l'étoile doit refléter la sélection en cours, y compris pendant un chargement.
  let favoriCibleActuel = $derived<Favori | null>(
    prefs.selection === 'cp' && prefs.lieuCP
      ? { type: 'cp', lieu: prefs.lieuCP }
      : prefs.selection !== 'cp' && nomVilleActive
        ? { type: 'ville', id: prefs.selection, nom: nomVilleActive }
        : null
  );
  let estFavoriActuel = $derived(favoriCibleActuel ? prefs.estFavori(favoriCibleActuel) : false);

  function basculerFavoriActuel(): void {
    if (favoriCibleActuel) prefs.basculerFavori(favoriCibleActuel);
  }

  /** Bascule vers un favori choisi dans l'écran Favoris, puis revient à l'accueil. */
  function choisirFavori(favori: Favori): void {
    meteo.choisirFavori(favori);
    allerA('accueil');
  }

  type Section = 'accueil' | 'carte' | 'favoris' | 'reglages';

  // Section mise en avant par la nav basse — purement visuel, aucune ancre
  // réelle vers un autre écran (l'app reste une page unique).
  let sectionActive = $state<Section>('accueil');
  let reduireMouvement =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const idSection: Record<Section, string> = {
    accueil: 'section-accueil',
    carte: 'section-carte',
    favoris: 'section-favoris',
    reglages: 'section-reglages',
  };

  function allerA(section: Section): void {
    sectionActive = section;
    document
      .getElementById(idSection[section])
      ?.scrollIntoView({ behavior: reduireMouvement ? 'auto' : 'smooth', block: 'start' });
  }

  onMount(() => {
    meteo.charger();
    meteo.chargerVilles();

    const enLigne      = () => { horsLigne = false; meteo.charger(); };
    const horsConnexion = () => { horsLigne = true; };
    window.addEventListener('online', enLigne);
    window.addEventListener('offline', horsConnexion);
    return () => {
      window.removeEventListener('online', enLigne);
      window.removeEventListener('offline', horsConnexion);
      meteo.annuler();
    };
  });
</script>

<main class={classeCiel}>
  <header id="section-accueil">
    <div class="ligne-titre">
      <h1 class="eyebrow">Prévisions · Québec</h1>
      <button
        class="bascule-unite pressable"
        onclick={() => prefs.basculerUnite()}
        aria-pressed={prefs.unite === 'imperial'}
        aria-label="Unités impériales"
      >°{libelleUniteTemp(prefs.unite)}</button>
    </div>
    <div class="recherche-groupe">
      <SelecteurVille
        villes={meteo.villes}
        lieuCP={prefs.lieuCP}
        selection={prefs.selection}
        onchoisir={meteo.choisirVille}
      />

      <RechercheCodePostal
        bind:valeur={prefs.codePostal}
        erreur={meteo.erreurCP}
        enCours={meteo.rechercheCP}
        onrechercher={meteo.rechercherCP}
      />
    </div>
  </header>

  <!--
    Les erreurs étaient bien annoncées — `role="alert"` plus bas crée une région
    assertive implicite. Le succès, lui, ne l'était par rien : changer de ville
    remplaçait la totalité du contenu sans qu'un lecteur d'écran l'apprenne.
    Cette région doit exister dans le DOM avant la mise à jour pour être lue,
    d'où sa place ici, hors des branches conditionnelles.
  -->
  <p class="sr-only" aria-live="polite">
    {#if !meteo.chargement && meteo.donnees}
      Prévisions pour {meteo.nomLieu}, mises à jour à {heureMinute(meteo.donnees.misAJour)}
    {/if}
  </p>

  {#if horsLigne}
    <p class="bandeau-hors-ligne">Hors ligne — dernières prévisions enregistrées</p>
  {:else if meteo.donnees?.obsolete}
    <!--
      Le backend a servi une entrée périmée : l'amont est en panne, mais des
      prévisions un peu datées valent mieux qu'un écran vide. Le dire évite que
      l'heure de mise à jour affichée en pied de page passe pour l'heure réelle.
    -->
    <p class="bandeau-hors-ligne">
      Service météo momentanément indisponible — prévisions non actualisées
    </p>
  {/if}

  <!--
    Une erreur survenue alors qu'on a encore des prévisions valides devient un
    bandeau, pas un écran plein : l'ordre des branches faisait disparaître des
    données parfaitement lisibles, toujours présentes en mémoire — l'inverse de
    ce que promet une application hors ligne d'abord.
  -->
  {#if meteo.erreur && meteo.donnees && !meteo.chargement}
    <div class="bandeau-erreur" role="alert">
      <p>{meteo.erreur}</p>
      <button class="reessayer btn-pilule pressable" onclick={meteo.charger}>Réessayer</button>
    </div>
  {/if}

  {#if meteo.chargement}
    <!--
      Squelette aux hauteurs approximatives du contenu qu'il remplace : un
      simple spinner laissait toute la page (horaire, 7 jours, carte, puis
      Favoris/Réglages/pied de page) sauter vers le bas à l'arrivée des
      données — CLS de 0,6 mesuré par PageSpeed (seuil « bon » : 0,1).
    -->
    <div class="squelette" role="status" aria-busy="true">
      <p class="sr-only">Chargement des prévisions…</p>
      <div class="sq-bloc sq-hero" aria-hidden="true"></div>
      <div class="sq-bloc sq-horaire" aria-hidden="true"></div>
      <div class="sq-bloc sq-quotidien" aria-hidden="true"></div>
      <div class="sq-bloc sq-carte" aria-hidden="true"></div>
    </div>
  {:else if meteo.erreur && !meteo.donnees}
    <div class="etat erreur" role="alert">
      <p>{meteo.erreur}</p>
      <button class="reessayer btn-pilule pressable" onclick={meteo.charger}>Réessayer</button>
    </div>
  {:else if meteo.donnees}
    <ConditionsActuelles
      actuel={meteo.donnees.actuel}
      lieu={meteo.nomLieu}
      sousTitre="Québec"
      unite={prefs.unite}
      estFavori={estFavoriActuel}
      onbasculerFavori={basculerFavoriActuel}
      villeId={prefs.selection !== 'cp' ? prefs.selection : null}
    />

    <BandeauAlerte alertes={meteo.donnees.alertes} onvoirplus={() => allerA('reglages')} />

    <Horaire heures={meteo.donnees.horaire} unite={prefs.unite} />

    <Quotidien jours={meteo.donnees.quotidien} unite={prefs.unite} />

    {#if !horsLigne}
      <div id="section-carte">
        <CarteNuages
          latitude={meteo.donnees.ville.latitude}
          longitude={meteo.donnees.ville.longitude}
          nom={meteo.donnees.ville.nom}
          heures={meteo.donnees.horaire}
        />
      </div>
    {/if}
  {/if}

  <!--
    Favoris et Réglages ne dépendent d'aucune prévision : contrairement à
    `ConditionsActuelles`/`Horaire`/etc., ils restent hors du bloc conditionnel
    ci-dessus et donc atteignables pendant un chargement ou un écran d'erreur —
    même raisonnement que le pied de page juste en dessous.
  -->
  <div id="section-favoris">
    <Favoris
      favoris={prefs.favoris}
      unite={prefs.unite}
      onchoisir={choisirFavori}
      onretirer={(f) => prefs.retirerFavori(f)}
    />
  </div>

  <div id="section-reglages" class="reglages carte-verre">
    <h2 class="titre-carte">Réglages</h2>
    <div class="ligne-reglage">
      <span>Unités</span>
      <button
        class="bascule-unite-large btn-verre pressable"
        onclick={() => prefs.basculerUnite()}
        aria-pressed={prefs.unite === 'imperial'}
      >°{libelleUniteTemp(prefs.unite)}</button>
    </div>
    {#if prefs.selection !== 'cp' && nomVilleActive}
      <AlertesMeteo villeId={prefs.selection} villeNom={nomVilleActive} />
    {/if}
  </div>

  <!--
    Le pied est hors du bloc conditionnel : il portait uniquement l'heure de
    mise à jour et vivait donc à l'intérieur de `{:else if donnees}`, ce qui le
    faisait disparaître pendant le chargement et sur un écran d'erreur.
    Acceptable pour une horodate, pas pour l'avertissement météo ni pour l'accès
    aux pages légales — qui doivent rester atteignables précisément quand
    l'application ne fonctionne pas.

    Seule la ligne de mise à jour reste conditionnée aux données : elle n'a
    aucun sens sans elles.

    Les liens n'ouvrent pas de nouvel onglet. Ces pages sont servies par la même
    origine, à l'intérieur du périmètre déclaré de la TWA Android : une
    navigation ordinaire reste dans la coquille, et chaque page porte un lien de
    retour vers `/`. Un `target="_blank"` ferait surgir un onglet de navigateur
    par-dessus l'application.
  -->
  <footer>
    {#if meteo.donnees}
      <p>
        Mis à jour à {heureMinute(meteo.donnees.misAJour)} · Données
        <a href="https://open-meteo.com" target="_blank" rel="noreferrer">Open-Meteo</a>
      </p>
    {/if}
    <p class="avertissement">
      Prévisions fournies à titre indicatif — ne pas les utiliser pour des décisions critiques.
    </p>
    <nav class="legal" aria-label="Informations légales">
      <a href="/privacy-policy.html">Confidentialité</a>
      <span aria-hidden="true">·</span>
      <a href="/terms.html">Conditions</a>
      <span aria-hidden="true">·</span>
      <a href="/legal.html">Mentions légales</a>
    </nav>
  </footer>

  <BottomNav actif={sectionActive} onnaviguer={allerA} />
</main>

<style>
  header { display: flex; flex-direction: column; gap: 0.75rem; }
  /*
    Les textes secondaires posés à nu sur le ciel n'ont plus d'`opacity` : sous
    le voile, il faudrait au moins 0.93 pour tenir 4.5:1, ce qui ne se distingue
    plus de 1. La hiérarchie tient déjà par la taille, la graisse et l'interlettrage.
  */
  .eyebrow { margin: 0; font-size: 0.75rem; font-weight: 400; letter-spacing: 0.18em; text-transform: uppercase; }

  .ligne-titre { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; }

  .recherche-groupe { display: flex; flex-direction: column; gap: 0.6rem; }

  /* Même voile que le déclencheur de `SelecteurVille.svelte` : cf. son historique de contraste. */
  .bascule-unite {
    flex-shrink: 0;
    border: 1px solid var(--verre-bordure);
    background: rgba(0,0,0,0.25); color: #fff; font: inherit;
    font-weight: 700; font-size: 0.8rem; line-height: 1;
    width: 2.1rem; height: 2.1rem; border-radius: 50%; cursor: pointer;
    backdrop-filter: blur(10px);
  }
  .bascule-unite:focus-visible { outline: var(--contour-focus); outline-offset: 2px; }

  .bandeau-hors-ligne {
    margin: 1rem 0 0; padding: 0.5rem 0.9rem;
    background: rgba(0,0,0,0.3); border-radius: 0.6rem; font-size: 0.85rem;
    border: 1px solid var(--verre-bordure);
  }

  .bandeau-erreur {
    display: flex; align-items: center; justify-content: space-between;
    gap: 0.75rem; flex-wrap: wrap;
    margin: 1rem 0 0; padding: 0.6rem 0.9rem;
    background: rgba(120,20,20,0.45); border-radius: 0.6rem; font-size: 0.85rem;
    border: 1px solid rgba(255,140,140,0.3);
  }
  .bandeau-erreur p { margin: 0; }
  .bandeau-erreur .reessayer { padding: 0.35rem 0.9rem; font-size: 0.85rem; }

  .etat { text-align: center; padding: 4rem 1rem; }

  /* Hauteurs = ordre de grandeur de `ConditionsActuelles`, `Horaire`,
     `Quotidien` et `CarteNuages` sur mobile ; à réajuster si l'un d'eux change. */
  .squelette { display: flex; flex-direction: column; gap: 0.9rem; padding-top: 1rem; }
  .sq-bloc {
    border-radius: var(--rayon-carte);
    background: rgba(255, 255, 255, 0.08);
    animation: pulse 1.4s ease-in-out infinite;
  }
  .sq-hero { min-height: 22rem; }
  .sq-horaire { min-height: 9.5rem; }
  .sq-quotidien { min-height: 24rem; }
  .sq-carte { min-height: 22rem; }
  @keyframes pulse { 50% { opacity: 0.5; } }
  @media (prefers-reduced-motion: reduce) {
    .sq-bloc { animation: none; }
    main { transition: none; }
  }
  .reessayer { padding: 0.5rem 1.25rem; }

  footer { margin-top: 1.75rem; text-align: center; font-size: 0.8rem; }
  footer a { color: inherit; }
  footer p { margin: 0.35rem 0; }

  /*
    Ni `opacity` ni gris pâle sur ces deux blocs : ils sont posés à nu sur le
    ciel, où la règle est la même que pour `.eyebrow` — sous le voile, il
    faudrait au moins 0.93 pour tenir 4.5:1, ce qui ne se distingue plus de 1.
    La hiérarchie passe donc par la taille et l'interlettrage.
  */
  .avertissement { font-size: 0.75rem; }

  .legal {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
    margin-top: 0.5rem;
    font-size: 0.75rem;
  }
  /* Cible tactile : les liens sont petits et voisins. */
  .legal a { padding: 0.15rem 0; }

  .reglages {
    background: rgba(0, 0, 0, 0.2);
    padding: 1.1rem;
    margin-top: 0.9rem;
  }
  .reglages h2 { margin: 0 0 0.7rem; }
  .ligne-reglage {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0;
  }
  .bascule-unite-large { font-weight: 700; padding: 0.4rem 1rem; }
</style>
