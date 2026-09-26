<script lang="ts">
  interface Props {
    valeur: string;
    erreur: string | null;
    /** Vrai tant qu'un géocodage est en vol : sans quoi rien ne bouge à l'écran. */
    enCours?: boolean;
    onrechercher: (saisie: string) => void;
  }

  let { valeur = $bindable(), erreur, enCours = false, onrechercher }: Props = $props();

  function rechercher(): void {
    const saisie = valeur.trim();
    if (!saisie || enCours) return;
    onrechercher(saisie);
  }
</script>

<!--
  Un vrai `form` plutôt qu'un `onkeydown` maison : la soumission implicite au
  clavier vient gratuitement, et `enterkeyhint` donne une touche « rechercher »
  sur les claviers mobiles.
-->
<form class="recherche-cp" onsubmit={(e) => (e.preventDefault(), rechercher())}>
  <label class="visually-hidden" for="cp">Code postal canadien</label>
  <input
    id="cp"
    type="text"
    placeholder="Code postal (ex. K1A 0B1)"
    bind:value={valeur}
    autocomplete="postal-code"
    enterkeyhint="search"
    maxlength="7"
  />
  <button type="submit" disabled={enCours}>
    {enCours ? 'Recherche…' : 'Rechercher'}
  </button>
</form>
{#if erreur}
  <p class="erreur-cp" role="alert">{erreur}</p>
{/if}

<style>
  .recherche-cp { display: flex; gap: 0.4rem; }
  .recherche-cp input {
    flex: 1; min-width: 0; border-radius: 999px;
    border: 1px solid var(--verre-bordure, rgba(112,170,255,0.22));
    padding: 0.55rem 0.9rem; font: inherit;
    background: rgba(0,0,0,0.22); color: #fff; backdrop-filter: blur(10px);
  }
  .recherche-cp input::placeholder { color: rgba(255,255,255,0.65); }
  .recherche-cp input:focus-visible { outline: 2px solid #fff; outline-offset: 1px; }
  /*
    Fond bleu clair + texte marine plutôt que bleu vif + blanc : ce dernier ne
    tenait que 2.62:1 (`e2e/accessibilite.spec.ts`, axe), loin des 4.5:1 requis
    — un fond aussi lumineux a besoin d'un texte sombre, pas blanc.
  */
  .recherche-cp button {
    border: 0; border-radius: 999px; padding: 0.55rem 1.1rem;
    font: inherit; font-weight: 700; background: var(--accent-doux, #a9d3ff); color: #0d1c30; cursor: pointer;
  }
  .recherche-cp button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
  .recherche-cp button:disabled { opacity: 0.6; cursor: progress; }
  .erreur-cp {
    margin: 0.4rem 0 0; font-size: 0.85rem;
    background: rgba(0,0,0,0.3); padding: 0.45rem 0.8rem; border-radius: 0.6rem;
  }

  .visually-hidden {
    position: absolute; width: 1px; height: 1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
  }
</style>
