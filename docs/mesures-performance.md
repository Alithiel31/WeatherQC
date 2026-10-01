# Mesures de performance — base de référence V2

🇬🇧 [English version](./mesures-performance.en.md)

[Retour au README](../README.md)

Point de départ chiffré, pris sur `main` (`eb63ed1`) avant tout changement de la V2. Il sert
de point de comparaison : une optimisation qui ne déplace pas ces chiffres n'en est pas une.

## Comment lire ces chiffres

Mesures **en laboratoire**, pas sur un vrai téléphone : le build de production est servi par
`vite preview`, l'API est **simulée** (Open-Meteo est injoignable depuis l'environnement de
mesure) et les tuiles RainViewer/CARTO n'ont pas pu se charger. Le coût réel de la carte est
donc **sous-estimé** ici. Pour un chiffre fiable, refaire un passage Lighthouse mobile sur le
site déployé, depuis un appareil réel.

## Tests

| | Fichiers | Tests | Instructions | Branches | Fonctions | Lignes |
|---|---|---|---|---|---|---|
| Frontend | 19 | 375 | 96,85 % | 91,42 % | 94,82 % | 96,99 % |
| Backend | — | 297 | 99,06 % | 96,19 % | 99,18 % | 99,17 % |

Tout passe. Les seuils de `vitest.config.ts` (frontend 94/87/93/94, backend 97/95/95/97) sont
respectés. Point le plus faible : `App.svelte` (89 % d'instructions, 80 % de branches).

## Bundle (`npm run build`, frontend)

| Fichier | Taille | gzip |
|---|---|---|
| `index-*.js` (application + Leaflet) | 232,0 ko | 73,5 ko |
| `index-*.css` | 37,1 ko | 11,0 ko |
| `workbox-window` | 5,7 ko | 2,2 ko |
| `sw.js` | 94,3 ko | 24,8 ko |

- **Un seul chunk JavaScript** : Leaflet est dans le bundle principal, alors que la carte est
  sous la ligne de flottaison.
- Précache du service worker : 14 entrées, 336 Kio.
- Photos de villes (`public/villes`) : 3,0 Mo au total pour 12 fichiers de 160 à 305 ko ;
  `saguenay-*` est encore en JPEG, les autres en WebP.

## Lighthouse (profil mobile, 3 passages sur le build local)

| | Passage 1 | Passage 2 | Passage 3 |
|---|---|---|---|
| Performance | 64 | 89 | 67 |
| Accessibilité | 100 | 100 | 100 |
| Bonnes pratiques | 96 | 96 | 96 |
| SEO | 100 | 100 | 100 |
| FCP | 1,52 s | 1,39 s | 1,37 s |
| LCP | 3,69 s | 3,69 s | 3,68 s |
| TBT | 194 ms | 82 ms | 81 ms |
| CLS | 0,60 | 0 | 0,60 |
| Poids transféré | 392 ko | 392 ko | 392 ko |
| Requêtes | 55 | 55 | 55 |

## Constats

1. **LCP ≈ 3,7 s : c'est la photo héro** (`montreal-jour.webp`, 294 ko), plus lourde que tout
   le JavaScript compressé. Premier levier : taille, dimensions et priorité de chargement.
2. **CLS instable (0 ou 0,60)** : le décalage vient de `#section-reglages`, qui est repoussée
   vers le bas quand le contenu (prévisions, carte) arrive après un état de chargement plus
   court. C'est la cause de l'écart de score entre passages. Un gabarit de hauteur réservée
   pour les sections dynamiques le supprimerait.
3. **Environ la moitié du JavaScript est inutilisée au chargement** (36 sur 73 ko gzip) :
   cohérent avec Leaflet et le code radar embarqués d'office.
4. Accessibilité 100 et SEO 100 : rien à corriger de ce côté à ce stade.
5. La seule alerte « bonnes pratiques » (erreurs console) vient des tuiles injoignables dans
   l'environnement de mesure ; à revérifier sur le site déployé.

## Reproduire

```bash
cd frontend && npm ci && npm run build && npx vite preview --port 4173
# API simulée sur le port 3005 (le proxy de `vite preview` y renvoie /api), puis :
npx lighthouse http://127.0.0.1:4173/ --preset=perf --form-factor=mobile
```
