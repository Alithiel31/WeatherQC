<script lang="ts">
  import './styles/verre.css';
  import { previsionsVille, previsionsCoordonnees } from './api.ts';
  import { cleFavori } from './preferences.svelte.ts';
  import { iconeMeteo, descriptionMeteo, degres } from './meteo.ts';
  import type { Unite } from './meteo.ts';
  import type { Favori } from './types.ts';

  interface Props {
    favoris?: Favori[];
    unite?: Unite;
    onchoisir: (favori: Favori) => void;
    onretirer: (favori: Favori) => void;
  }

  const { favoris = [], unite = 'metrique', onchoisir, onretirer }: Props = $props();

  interface Resume {
    temperature: number;
    code: number;
    jour: boolean;
  }

  // Un favori dont l'amont échoue affiche juste « Indisponible » — ça n'empêche
  // pas les autres cartes de la liste de s'afficher normalement.
  let resumes = $state<Record<string, Resume | 'erreur' | 'chargement'>>({});

  async function charger(favori: Favori): Promise<void> {
    const cle = cleFavori(favori);
    resumes[cle] = 'chargement';
    try {
      const donnees =
        favori.type === 'ville'
          ? await previsionsVille(favori.id)
          : await previsionsCoordonnees(favori.lieu);
      resumes[cle] = {
        temperature: donnees.actuel.temperature,
        code: donnees.actuel.code,
        jour: donnees.actuel.jour,
      };
    } catch {
      resumes[cle] = 'erreur';
    }
  }

  function nomFavori(favori: Favori): string {
    return favori.type === 'ville' ? favori.nom : favori.lieu.nom;
  }

  // Charge le résumé de chaque favori pas encore vu — au montage, et de nouveau
  // si la liste change (ajout depuis l'étoile pendant que cet écran est monté).
  // Un favori déjà chargé ne l'est pas une seconde fois : `resumes` fait office
  // de mémoire, la clé de `cleFavori` la relie à la bonne entrée.
  $effect(() => {
    for (const favori of favoris) {
      if (!(cleFavori(favori) in resumes)) charger(favori);
    }
  });
</script>

<section class="favoris carte-verre" aria-label="Lieux favoris">
  <h2>Favoris</h2>
  {#if favoris.length === 0}
    <p class="vide">
      Aucun favori pour l'instant — l'étoile à côté du nom de lieu en ajoute un.
    </p>
  {:else}
    <ul>
      {#each favoris as favori (cleFavori(favori))}
        {@const cle = cleFavori(favori)}
        {@const resume = resumes[cle]}
        <li class="entree-douce">
          <button type="button" class="cible pressable" onclick={() => onchoisir(favori)}>
            <span class="nom">{nomFavori(favori)}</span>
            {#if resume === 'erreur'}
              <span class="etat">Indisponible</span>
            {:else if resume && resume !== 'chargement'}
              <span class="icone" role="img" aria-label={descriptionMeteo(resume.code)}
                >{iconeMeteo(resume.code, resume.jour)}</span
              >
              <span class="temp">{degres(resume.temperature, unite)}</span>
            {:else}
              <span class="etat" aria-hidden="true">···</span>
            {/if}
          </button>
          <button
            type="button"
            class="retirer pressable"
            onclick={() => onretirer(favori)}
            aria-label={`Retirer ${nomFavori(favori)} de la liste des favoris`}
          >✕</button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  section {
    background: rgba(0, 0, 0, 0.2);
    padding: 1.1rem;
    margin-top: 0.9rem;
  }
  h2 {
    margin: 0 0 0.6rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    opacity: 0.75;
  }
  .vide { margin: 0; font-size: 0.9rem; opacity: 0.85; }
  ul { margin: 0; padding: 0; list-style: none; }
  li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-top: 1px solid var(--verre-bordure, rgba(112, 170, 255, 0.22));
  }
  li:first-child { border-top: 0; }
  .cible {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 0;
    border: 0;
    background: transparent;
    color: #fff;
    font: inherit;
    text-align: left;
    padding: 0.3rem 0;
    cursor: pointer;
  }
  .nom { flex: 1; min-width: 0; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icone { font-size: 1.1rem; }
  .temp { font-weight: 600; font-variant-numeric: tabular-nums; }
  .etat { font-size: 0.8rem; opacity: 0.75; }
  .retirer {
    flex-shrink: 0;
    border: 0;
    background: rgba(0, 0, 0, 0.25);
    color: #fff;
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 50%;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .retirer:focus-visible,
  .cible:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
</style>
