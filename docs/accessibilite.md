# Accessibilité

🇬🇧 [English version](./accessibilite.en.md)

[Retour au README](../README.md)

Ce document résume ce qui est déjà vérifié automatiquement, ce qui a été ajouté pour combler
les trous restants, et ce qui reste — par nature — hors de portée des outils automatisés. Il
existe pour qu'un futur repreneur (voir [docs/guide-de-reprise.md](./guide-de-reprise.md)) n'ait
pas à réinvestiguer tout ça de zéro.

---

## Ce qui est déjà vérifié automatiquement

| Quoi | Où | Comment |
|---|---|---|
| Contraste WCAG AA (4.5:1) | `frontend/tests/unit/contraste.test.ts` | Calcul numérique sur les constantes CSS — axe ne sait pas mesurer un fond en dégradé |
| Rôles, noms accessibles, structure | `frontend/e2e/accessibilite.spec.ts` | `@axe-core/playwright`, tags WCAG 2.0/2.1 A+AA, sur les 9 familles de ciel et les 6 pages légales FR/EN |
| Navigation clavier | idem + `SelecteurVille.svelte`, `Horaire.svelte` | Bande horaire focusable, menu ville avec flèches/Home/End/Échap |
| `prefers-reduced-motion` | `App.svelte`, `CarteNuages.svelte` | CSS et `matchMedia` |
| Reflow à 320px (WCAG 1.4.10) | `frontend/e2e/accessibilite.spec.ts` | Aucun défilement horizontal du document à la largeur d'un iPhone SE |
| Taille des cibles tactiles ≥ 24×24px (WCAG 2.5.8) | `frontend/e2e/accessibilite.spec.ts` | Hors liens en ligne dans du texte et balisage propre à Leaflet — voir le commentaire du test |

## Ce qui a été ajouté : l'alternative texte à la carte

La carte radar/satellite (`CarteNuages.svelte`) est **exclue** des scans axe (`.exclude('.carte')`)
parce que son balisage est généré par Leaflet et n'est pas le nôtre. Jusqu'ici, elle n'avait
**aucun équivalent non-visuel** : un utilisateur qui ne peut pas voir la carte n'apprenait rien
de ce qu'elle montre.

`resumeCarte()` (`frontend/src/lib/meteo.ts`) résume la même donnée de probabilité de
précipitation que la bande horaire (`Horaire.svelte`), pas les tuiles elles-mêmes, et rend une
phrase du type *« Pluie en cours ou imminente, probabilité de 45 %. »* — affichée en texte
visible juste avant la carte, pas seulement pour les lecteurs d'écran. Le seuil de 20 % reprend
celui déjà utilisé par `Horaire.svelte` pour afficher son propre badge de pluie, plutôt que
d'introduire un second seuil arbitraire.

## Ce qui reste hors de portée des outils automatisés

- **Les tuiles radar/satellite elles-mêmes** restent purement visuelles — `resumeCarte()` en
  donne un résumé texte, pas un équivalent complet (la distribution spatiale des précipitations
  ne se résume pas en une phrase).
- **axe-core ne détecte statistiquement qu'une partie des violations réelles** (ordre de lecture
  logique, pertinence sémantique fine) — voir le script de vérification manuelle ci-dessous.
- **Le balisage injecté par Leaflet** (attribution, contrôles de zoom) reste hors de portée des
  tests axe et de taille de cible, pour la même raison qu'il est hors de portée des tests de
  contraste : il ne nous appartient pas.

## Script de vérification manuelle avec un lecteur d'écran

À faire une fois avec VoiceOver (macOS/iOS) ou NVDA (Windows) — aucun outil automatisé ne
remplace ce parcours :

1. Ouvrir l'application, lecteur d'écran activé, sans toucher la souris/le trackpad.
2. Parcourir le titre, le sélecteur de ville et la recherche par code postal au clavier (Tab) —
   chaque contrôle doit s'annoncer clairement (nom, rôle, état).
3. Ouvrir le sélecteur de ville, naviguer avec les flèches, choisir une ville avec Entrée —
   vérifier que le changement est annoncé (`aria-live`, déjà couvert par
   `frontend/e2e/accessibilite.spec.ts`, mais à confirmer à l'oreille).
4. Rechercher un code postal invalide — l'erreur doit être annoncée immédiatement.
5. Atteindre la bande horaire (48h) au clavier, vérifier que chaque heure annonce l'heure, la
   condition météo (pas seulement la température) et, le cas échéant, la probabilité de pluie.
6. Atteindre la carte animée — vérifier que le résumé texte introduit ci-dessus est bien lu
   *avant* que le lecteur d'écran n'entre dans la carte elle-même.
7. Activer/désactiver les alertes météo pour la ville courante — vérifier que le message de
   confirmation ou d'erreur est annoncé.
8. Atteindre le pied de page et les liens légaux — vérifier qu'ils sont annoncés comme des liens
   distincts, pas comme un seul bloc de texte.

Noter tout ce qui surprend (silence inattendu, ordre de lecture illogique, libellé ambigu) —
même sans corriger dans l'immédiat, une note ici vaut mieux qu'un oubli.
