<script lang="ts">
  import './styles/verre.css';
  import {
    descriptionMeteo,
    iconeMeteo,
    degres,
    temperatureArrondie,
    vitesseVent,
    libelleUniteTemp,
    libelleUniteVent,
  } from './meteo.ts';
  import { photoVille } from './villesPhotos.ts';
  import type { Unite } from './meteo.ts';
  import type { ConditionsActuelles } from './types.ts';

  interface Props {
    actuel: ConditionsActuelles;
    lieu: string;
    /** "Canada" ou "‹province›, Canada" — figé au même moment que `lieu`, voir App.svelte. */
    sousTitre?: string;
    unite?: Unite;
    /** Absents en dehors d'`App.svelte` (tests, aperçu isolé) : l'étoile ne s'affiche pas. */
    estFavori?: boolean;
    onbasculerFavori?: () => void;
    /** `prefs.selection`, sauf pour un lieu par code postal — voir `villesPhotos.ts`. */
    villeId?: string | null;
  }

  const {
    actuel,
    lieu,
    sousTitre = '',
    unite = 'metrique',
    estFavori = false,
    onbasculerFavori,
    villeId = null,
  }: Props = $props();

  let photoSrc = $derived(photoVille(villeId, !actuel.jour));

  // Bascule à `true` à chaque changement de `photoSrc` (nouvelle ville, ou
  // jour → nuit) : sans ça, un premier échec de chargement condamnait aussi
  // les villes/moments suivants, qui n'ont pourtant pas encore été essayés.
  let photoOk = $state(true);
  $effect(() => {
    photoSrc;
    photoOk = true;
  });
</script>

<section class="actuel" aria-label="Conditions actuelles">
  <header class="lieu-entete">
    <svg class="pin" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.4" />
    </svg>
    <div class="lieu-texte">
      <p class="lieu">{lieu}</p>
      {#if sousTitre}<p class="sous-lieu">{sousTitre}</p>{/if}
    </div>
    {#if onbasculerFavori}
      <button
        type="button"
        class="favori pressable"
        aria-pressed={estFavori}
        aria-label={estFavori ? `Retirer ${lieu} des favoris` : `Ajouter ${lieu} aux favoris`}
        onclick={onbasculerFavori}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill={estFavori ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="1.8" stroke-linejoin="round">
          <path d="M12 3.5 14.7 9l6 .9-4.35 4.15L17.4 20 12 17l-5.4 3 1.05-5.95L3.3 9.9l6-.9 2.7-5.5Z" />
        </svg>
      </button>
    {/if}
  </header>

  <div class="bande-hero">
    {#if photoSrc && photoOk}
      <img
        class="photo"
        src={photoSrc}
        alt=""
        aria-hidden="true"
        onerror={() => (photoOk = false)}
      />
      <!-- Voile de contraste, pas la couleur du ciel : pleinement opaque côté
           texte (aucun pixel de la photo, quelle qu'en soit la clarté, ne
           doit y transparaître), il s'efface ensuite vers la droite où la
           photo n'a plus de texte à porter. Composé à .88 sur du blanc pur
           (le pire cas possible), le résultat reste sous #26303c — largement
           sous le seuil 4.5:1 avec du texte blanc par-dessus. Pas de calcul
           automatisé possible ici (photo, pas un littéral CSS) : cf.
           `tests/unit/contraste.test.ts`, qui ne couvre que les dégradés de
           secours d'App.svelte. -->
      <div class="voile-photo" aria-hidden="true"></div>
    {/if}
    <div class="hero">
      <span class="icone" aria-hidden="true">{iconeMeteo(actuel.code, actuel.jour)}</span>
      <div class="hero-texte">
        <p class="condition">{descriptionMeteo(actuel.code)}</p>
        <p class="temperature">{temperatureArrondie(actuel.temperature, unite)}<sup>°{libelleUniteTemp(unite)}</sup></p>
        <p class="ressenti">Ressenti <span>{degres(actuel.ressenti, unite)}</span></p>
      </div>
    </div>
  </div>

  <dl class="details">
    <div><dt>Vent</dt><dd>{vitesseVent(actuel.vent, unite)} {libelleUniteVent(unite)}</dd></div>
    <div><dt>Humidité</dt><dd>{actuel.humidite} %</dd></div>
  </dl>
</section>

<style>
  .actuel { text-align: left; padding: 1.5rem 0 1.75rem; }

  /*
    Bloc posé à nu sur le ciel (dégradé + voile de page, pas de voile de carte
    propre) : cf. le commentaire de contraste dans `App.svelte`. Aucune
    `opacity` réduite sur le texte ici, elle ferait retomber sous 4.5:1 — la
    hiérarchie tient par la taille, la graisse et l'interlettrage, jamais par
    la transparence.
  */
  .lieu-entete {
    display: flex; align-items: center; gap: 0.5rem;
  }
  .pin { flex-shrink: 0; margin-top: 0.1rem; }
  /* `flex-grow` pousse l'étoile au bord droit — sans effet quand elle est
     absente (rien après `.lieu-texte` dans ce cas). */
  .lieu-texte { text-align: left; flex-grow: 1; }
  .favori {
    flex-shrink: 0; margin-left: 0.15rem;
    border: 0; background: transparent; color: #fff; padding: 0.2rem;
    cursor: pointer; line-height: 0;
  }
  .favori svg { color: var(--accent-doux, #a9d3ff); }
  .favori:focus-visible { outline: 2px solid #fff; outline-offset: 2px; border-radius: 0.3rem; }

  /*
    Le rebond ne joue qu'à l'ajout (attribut passant à "true"), jamais au
    retrait : `animation-name` change de `none` à `pop` uniquement quand ce
    sélecteur se met à matcher, ce qui suffit à déclencher l'animation sans
    JS ni état supplémentaire.
  */
  @keyframes pop { 0% { transform: scale(1); } 45% { transform: scale(1.35); } 100% { transform: scale(1); } }
  .favori[aria-pressed="true"] svg { animation: pop 0.35s ease; }
  @media (prefers-reduced-motion: reduce) {
    .favori[aria-pressed="true"] svg { animation: none; }
  }
  .lieu { margin: 0; font-size: 1.2rem; font-weight: 700; }
  .sous-lieu {
    margin: 0.1rem 0 0; font-size: 0.7rem; font-weight: 600;
    letter-spacing: 0.12em; text-transform: uppercase;
  }

  /*
    Bande bleedée jusqu'au bord de l'écran (marges négatives = le padding
    horizontal de `main`, cf. App.svelte) : c'est elle qui porte la photo,
    jamais `.hero` — `.hero` reste un simple conteneur de texte pour que le
    reste de la section n'ait pas à connaître l'existence de la photo.
  */
  .bande-hero {
    position: relative;
    margin: 0.65rem -1.25rem 0;
    padding: 0 1.25rem;
    overflow: hidden;
  }
  @media (min-width: 640px) {
    .bande-hero { margin-inline: -2rem; padding-inline: 2rem; }
  }
  .photo {
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover; object-position: 78% 45%;
  }
  .voile-photo {
    position: absolute; inset: 0;
    background-image: linear-gradient(
      100deg,
      rgba(6, 14, 26, 0.88) 0%,
      rgba(6, 14, 26, 0.88) 34%,
      rgba(6, 14, 26, 0.5) 62%,
      rgba(6, 14, 26, 0) 84%
    );
  }

  .hero {
    position: relative;
    display: flex; flex-direction: column; align-items: flex-start;
    gap: 0.15rem; padding: 1.1rem 0 1.35rem;
  }
  .icone { font-size: 3.4rem; line-height: 1; }
  .hero-texte { text-align: left; }
  .condition { margin: 0.3rem 0 0; font-size: 1.05rem; font-weight: 600; }
  .temperature {
    margin: 0.1rem 0 0;
    font-size: clamp(4rem, 19vw, 6rem); font-weight: 200;
    line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums;
  }
  .temperature sup { font-size: 0.32em; font-weight: 400; vertical-align: super; }
  .ressenti { margin: 0.2rem 0 0; font-size: 0.95rem; font-weight: 500; }

  .details { display: flex; justify-content: center; gap: 2.5rem; margin: 1.5rem 0 0; }
  .details dt { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.1em; }
  .details dd { margin: 0.2rem 0 0; font-size: 1.1rem; font-weight: 600; font-variant-numeric: tabular-nums; }
</style>
