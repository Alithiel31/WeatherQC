<script lang="ts">
  interface Props {
    valeur: string;
    erreur: string | null;
    onrechercher: (saisie: string) => void;
  }

  let { valeur = $bindable(), erreur, onrechercher }: Props = $props();

  function rechercher(): void {
    const saisie = valeur.trim();
    if (!saisie) return;
    onrechercher(saisie);
  }
</script>

<div class="recherche-cp">
  <label class="visually-hidden" for="cp">Code postal canadien</label>
  <input
    id="cp"
    type="text"
    placeholder="Code postal (ex. K1A 0B1)"
    bind:value={valeur}
    onkeydown={(e) => e.key === 'Enter' && rechercher()}
    autocomplete="postal-code"
    maxlength="7"
  />
  <button onclick={rechercher}>Rechercher</button>
</div>
{#if erreur}
  <p class="erreur-cp" role="alert">{erreur}</p>
{/if}

<style>
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
</style>
