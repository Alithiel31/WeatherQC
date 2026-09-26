<script lang="ts">
  import { onMount } from 'svelte';
  import './lib/styles/tokens.css';
  import './lib/styles/verre.css';
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
  import {
    previsionsVille,
    previsionsCoordonnees,
    geocoder,
    villesDisponibles,
    VILLES_REPLI,
    ErreurApi,
  } from './lib/api.ts';
  import { creerPreferences } from './lib/preferences.svelte.ts';
  import type { ReponseMeteo, VilleDisponible, Favori } from './lib/types.ts';

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

  // Pas d'abonnement par code postal (décision produit) : le nom n'est dérivé
  // que pour une ville du sélecteur, jamais pour `prefs.lieuCP`.
  let nomVilleActive = $derived(villes.find((v) => v.id === prefs.selection)?.nom ?? '');

  // Le lieu actuellement sélectionné, sous la forme que persiste `prefs.favoris`
  // — `null` si rien n'est encore résolu (ville du repli pas encore confirmée,
  // par exemple). Dérivé des préférences (pas figé comme `nomLieu`) : l'étoile
  // doit refléter la sélection en cours, y compris pendant un chargement.
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
    if (favori.type === 'ville') {
      choisirVille(favori.id);
    } else {
      // Déjà géocodé (c'est un favori) : inutile de regéocoder le RTA. `rta`
      // sert de saisie de repli — le code postal complet d'origine n'est pas
      // conservé dans le favori, seul le lieu géocodé l'est.
      prefs.retenirLieu(favori.lieu, favori.lieu.rta);
      charger();
    }
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
  <header id="section-accueil">
    <div class="ligne-titre">
      <h1 class="eyebrow">Prévisions · Québec</h1>
      <button
        class="bascule-unite"
        onclick={() => prefs.basculerUnite()}
        aria-pressed={prefs.unite === 'imperial'}
        aria-label="Unités impériales"
      >°{libelleUniteTemp(prefs.unite)}</button>
    </div>
    <div class="recherche-groupe">
      <SelecteurVille
        {villes}
        lieuCP={prefs.lieuCP}
        selection={prefs.selection}
        onchoisir={choisirVille}
      />

      <RechercheCodePostal
        bind:valeur={prefs.codePostal}
        erreur={erreurCP}
        enCours={rechercheCP}
        onrechercher={rechercherCP}
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
  <p class="annonce" aria-live="polite">
    {#if !chargement && donnees}
      Prévisions pour {nomLieu}, mises à jour à {heureMinute(donnees.misAJour)}
    {/if}
  </p>

  {#if horsLigne}
    <p class="bandeau-hors-ligne">Hors ligne — dernières prévisions enregistrées</p>
  {:else if donnees?.obsolete}
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
    <ConditionsActuelles
      actuel={donnees.actuel}
      lieu={nomLieu}
      sousTitre="Québec"
      unite={prefs.unite}
      estFavori={estFavoriActuel}
      onbasculerFavori={basculerFavoriActuel}
    />

    <BandeauAlerte alertes={donnees.alertes} />

    <Horaire heures={donnees.horaire} unite={prefs.unite} />

    <Quotidien jours={donnees.quotidien} unite={prefs.unite} />

    {#if !horsLigne}
      <div id="section-carte">
        <CarteNuages
          latitude={donnees.ville.latitude}
          longitude={donnees.ville.longitude}
          nom={donnees.ville.nom}
          heures={donnees.horaire}
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
    <h2>Réglages</h2>
    <div class="ligne-reglage">
      <span>Unités</span>
      <button
        class="bascule-unite-large"
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
    {#if donnees}
      <p>
        Mis à jour à {heureMinute(donnees.misAJour)} · Données
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
  :global(*) { box-sizing: border-box; }
  :global(body) {
    margin: 0;
    font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: #060e1a;
  }

  /*
    Le voile est une couche de fond constante posée par-dessus le ciel, pas une
    couleur de chaque dégradé : les ciels ne fournissent plus que leurs deux
    teintes, et la règle de contraste ne s'écrit qu'ici.

    Sans lui, le blanc pur échouait sur quatre des sept ciels — neige 1.64:1,
    dégagé 1.93, brouillard 2.06, nuageux 2.66, pour un seuil de 4.5. À 0.45 le
    pire cas remonte à 5.04:1, toutes les teintes étant conservées.
  */
  main {
    position: relative;
    min-height: 100dvh;
    color: #fff;
    padding: max(env(safe-area-inset-top), 1.25rem) 1.25rem
      calc(env(safe-area-inset-bottom) + 6rem);
    max-width: 32rem;
    margin: 0 auto;
    transition:
      background-color 0.8s ease,
      border-radius 0.2s ease,
      box-shadow 0.2s ease;
    background-color: #10243b;
    background-image:
      linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
      linear-gradient(180deg, var(--ciel-haut, #10243b) 0%, var(--ciel-bas, #10243b) var(--ciel-fin, 130%));
  }

  /*
    Couche atmosphérique décorative : étoiles la nuit par ciel dégagé, halo
    doux de jour, stries fines de pluie/neige/orage — en remplacement d'une
    photo de ville par lieu (aucune n'existe pour un lieu quelconque au
    Canada, cf. le choix de direction artistique). Empilée comme couches
    *additionnelles* du `background-image` de `main` lui-même plutôt que sur
    un pseudo-élément séparé : un pseudo `position:absolute` avec un
    `z-index` négatif ne forme un contexte d'empilement qu'au niveau de
    l'ancêtre englobant (`main` n'a pas de `z-index` propre), et se
    retrouvait ainsi peint sous le fond de page tout entier — invisible.
    Le fond d'un élément, lui, se peint toujours avant son contenu, sans
    ambiguïté d'empilement. Chaque règle ci-dessous reprend donc le voile et
    le dégradé de base en plus de sa couche propre ; les variables
    `--ciel-*` restent celles que `tests/unit/contraste.test.ts` relit.
  */
  .ciel.degage:not(.nuit) {
    background-image:
      radial-gradient(circle at 88% -6%, rgba(255, 214, 140, 0.4), transparent 55%),
      linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
      linear-gradient(180deg, var(--ciel-haut) 0%, var(--ciel-bas) var(--ciel-fin, 130%));
  }
  .ciel.degage.nuit {
    background-image:
      radial-gradient(1.8px 1.8px at 18% 10%, #fff 60%, transparent 65%),
      radial-gradient(1.4px 1.4px at 68% 7%, #fff 60%, transparent 65%),
      radial-gradient(1.6px 1.6px at 40% 16%, rgba(255,255,255,0.9) 60%, transparent 65%),
      radial-gradient(1.6px 1.6px at 84% 14%, #fff 60%, transparent 65%),
      radial-gradient(1.4px 1.4px at 55% 22%, rgba(255,255,255,0.8) 60%, transparent 65%),
      radial-gradient(1.4px 1.4px at 10% 26%, #fff 60%, transparent 65%),
      radial-gradient(1.4px 1.4px at 92% 24%, rgba(255,255,255,0.85) 60%, transparent 65%),
      radial-gradient(1.6px 1.6px at 30% 30%, #fff 60%, transparent 65%),
      radial-gradient(circle at 78% 2%, rgba(160, 190, 255, 0.2), transparent 45%),
      linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
      linear-gradient(180deg, var(--ciel-haut) 0%, var(--ciel-bas) var(--ciel-fin, 130%));
  }
  .ciel.pluie, .ciel.orage {
    background-image:
      repeating-linear-gradient(112deg, rgba(255,255,255,0.08) 0 2px, transparent 2px 16px),
      linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
      linear-gradient(180deg, var(--ciel-haut) 0%, var(--ciel-bas) var(--ciel-fin, 130%));
  }
  .ciel.neige {
    background-image:
      radial-gradient(1.6px 1.6px at 15% 8%, rgba(255,255,255,0.85) 65%, transparent 70%),
      radial-gradient(1.8px 1.8px at 45% 14%, rgba(255,255,255,0.75) 65%, transparent 70%),
      radial-gradient(1.4px 1.4px at 75% 5%, rgba(255,255,255,0.8) 65%, transparent 70%),
      radial-gradient(1.6px 1.6px at 90% 18%, rgba(255,255,255,0.7) 65%, transparent 70%),
      radial-gradient(1.4px 1.4px at 25% 22%, rgba(255,255,255,0.65) 65%, transparent 70%),
      linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)),
      linear-gradient(180deg, var(--ciel-haut) 0%, var(--ciel-bas) var(--ciel-fin, 140%));
  }

  /*
    Base mobile-first inchangée en dessous de 640px : `main` occupe tout
    l'écran comme avant. Au-delà, la carte se détache du fond au lieu de
    s'étirer indéfiniment dans un bandeau vide — cf. discussion sur le rendu
    desktop. `min-width` plutôt que `max-width` : on part du mobile et on
    ajoute, on ne part pas du desktop pour retirer.
  */
  @media (min-width: 640px) {
    main {
      max-width: 42rem;
      margin: 2rem auto;
      min-height: auto;
      border-radius: 1.5rem;
      box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.35);
    }
  }

  /*
    Au-delà du mobile, la colonne de 32rem flottait au milieu d'un fond uni
    de la même teinte que le body — aucune démarcation, juste un grand vide de
    part et d'autre. Le mobile reste inchangé sous ce seuil ; au-delà, la
    colonne s'élargit et se détache visuellement du fond avec une ombre et un
    liseré, plutôt que de s'étirer en pleine largeur.
  */
  @media (min-width: 640px) {
    :global(body) { background: #050b16; }

    main {
      min-height: auto;
      max-width: 40rem;
      margin: 2.5rem auto;
      padding: 2rem 2rem calc(env(safe-area-inset-bottom) + 6rem);
      border-radius: 1.5rem;
      box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.06);
    }
  }

  .ciel.degage       { --ciel-haut: #1f6fc4; --ciel-bas: #7fc2ee; }
  .ciel.degage.nuit  { --ciel-haut: #081226; --ciel-bas: #1d3a61; }
  .ciel.nuageux      { --ciel-haut: #4a5d72; --ciel-bas: #8da1b4; }
  .ciel.nuageux.nuit { --ciel-haut: #1a2531; --ciel-bas: #3c4d5f; }
  .ciel.pluie, .ciel.pluie.nuit { --ciel-haut: #2e3d4e; --ciel-bas: #5d7186; }
  .ciel.neige        { --ciel-haut: #5b7493; --ciel-bas: #b9cce0; --ciel-fin: 140%; }
  .ciel.neige.nuit   { --ciel-haut: #232f42; --ciel-bas: #5b7493; --ciel-fin: 140%; }
  .ciel.orage, .ciel.orage.nuit { --ciel-haut: #141c29; --ciel-bas: #3d4d63; }
  .ciel.brouillard, .ciel.brouillard.nuit { --ciel-haut: #6c7b89; --ciel-bas: #aab6c1; --ciel-fin: 140%; }

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
    border: 1px solid var(--verre-bordure, rgba(112,170,255,0.22));
    background: rgba(0,0,0,0.25); color: #fff; font: inherit;
    font-weight: 700; font-size: 0.8rem; line-height: 1;
    width: 2.1rem; height: 2.1rem; border-radius: 50%; cursor: pointer;
    backdrop-filter: blur(10px);
  }
  .bascule-unite:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }

  /* Lue par les lecteurs d'écran, jamais affichée. `clip-path` plutôt que
     `display: none`, qui la retirerait de l'arbre d'accessibilité. */
  .annonce {
    position: absolute; width: 1px; height: 1px; margin: -1px;
    padding: 0; overflow: hidden; white-space: nowrap;
    clip-path: inset(50%); border: 0;
  }

  .bandeau-hors-ligne {
    margin: 1rem 0 0; padding: 0.5rem 0.9rem;
    background: rgba(0,0,0,0.3); border-radius: 0.6rem; font-size: 0.85rem;
    border: 1px solid var(--verre-bordure, rgba(112,170,255,0.22));
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
  .reglages h2 {
    margin: 0 0 0.7rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    opacity: 0.75;
  }
  .ligne-reglage {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0;
  }
  .bascule-unite-large {
    border: 1px solid var(--verre-bordure, rgba(112, 170, 255, 0.22));
    background: rgba(0, 0, 0, 0.25);
    color: #fff;
    font: inherit;
    font-weight: 700;
    padding: 0.4rem 1rem;
    border-radius: 999px;
    cursor: pointer;
  }
  .bascule-unite-large:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
</style>
