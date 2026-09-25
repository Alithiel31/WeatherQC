# Veille des APIs tierces

[Retour au README](../README.md)

Le backend et le frontend s'appuient sur cinq services externes **gratuits, sans contrat
formel ni SLA**. Un fournisseur peut changer ses conditions, son quota ou le format de ses
réponses sans préavis — c'est déjà arrivé : le fond de carte CARTO affiche un filigrane
« API KEY REQUIRED » depuis fin août 2026, sans annonce préalable repérée avant que l'app
ne l'affiche en production (voir `frontend/.env.example` et [docs/environnement.md](./environnement.md)).

Cette page centralise ce qu'il faut surveiller, où, et à quelle fréquence.

---

## Fournisseurs à surveiller

| Fournisseur | Usage dans le projet | Page à surveiller | Détecté automatiquement ? |
|---|---|---|---|
| [Open-Meteo](https://open-meteo.com) | Prévisions horaires/quotidiennes, sans clé API | [Conditions d'utilisation](https://open-meteo.com/en/terms) · [Tarifs](https://open-meteo.com/en/pricing) | ✅ `contract.yml` (nocturne) |
| [Zippopotam.us](https://www.zippopotam.us) | Géocodage des codes postaux (RTA québécoise) | [Page d'accueil](https://www.zippopotam.us) (pas de page CGU dédiée connue — vérifier la disponibilité du service et la stabilité du format de réponse) | ✅ `contract.yml` (nocturne) |
| [RainViewer](https://www.rainviewer.com) | Tuiles radar de précipitations | [Documentation API](https://www.rainviewer.com/api.html) | ✅ `contract.yml` (nocturne) |
| [OpenWeatherMap](https://openweathermap.org) | Repli sur la couverture nuageuse quand RainViewer n'a pas d'image satellite | [Tarifs](https://openweathermap.org/price) · [Conditions](https://openweathermap.org/terms) | ❌ aucun test de contrat |
| [CARTO](https://carto.com) | Fond de carte de l'onglet « Nuages » (`VITE_CARTO_API_KEY`) | [Mentions légales](https://carto.com/legal/) · [Page clé API](https://carto.com/basemaps/apikey/) | ❌ aucun test de contrat |

`contract.yml` (voir [docs/developpement.md](./developpement.md)) interroge les vraies APIs
chaque nuit et ouvre automatiquement une issue `derive-contrat` en cas de dérive de schéma —
mais seulement pour Open-Meteo, Zippopotam et RainViewer. **OpenWeatherMap et CARTO n'ont
aucun filet automatisé** : un changement chez ces deux fournisseurs (clé désormais
obligatoire, quota réduit, tarification introduite) ne sera visible qu'en vérifiant
manuellement, ou en le découvrant en production comme pour le filigrane CARTO.

---

## Ce qu'il faut regarder à chaque vérification

Pour chacun des cinq fournisseurs :

1. **Le service répond-il toujours sans clé/avec le plan gratuit actuel ?** (tester une requête
   réelle si le doute existe, plutôt que de se fier à la seule documentation)
2. **Le quota gratuit a-t-il changé ?** (nombre de requêtes/jour, limitation par IP...)
3. **Le format de réponse a-t-il visiblement changé ?** (nouveaux champs, champs renommés,
   erreurs différentes) — surtout pour OpenWeatherMap et CARTO, non couverts par `contract.yml`
4. **Une clé API est-elle devenue obligatoire, ou un filigrane/dégradation est-il apparu** (cas
   CARTO d'août 2026) ?
5. **Le fournisseur a-t-il annoncé une dépréciation ou un rachat/changement de propriétaire ?**

---

## Fréquence recommandée

- **Open-Meteo, Zippopotam, RainViewer** : couverts par `contract.yml` — une lecture de
  l'issue `derive-contrat` (si elle existe) suffit, pas besoin de vérification manuelle
  périodique.
- **OpenWeatherMap et CARTO** : vérification manuelle **trimestrielle**, ou immédiatement après
  toute anomalie visible en production (filigrane, tuiles manquantes, erreur 401/403 inattendue).

---

## Journal de vérification

À compléter à chaque passage sur OpenWeatherMap et/ou CARTO (les trois autres fournisseurs sont
couverts par `contract.yml`, inutile de les journaliser ici).

| Date | Fournisseur | Résultat | Action prise |
|---|---|---|---|
| 2026-09 (constaté en prod) | CARTO | Filigrane « API KEY REQUIRED » apparu sur le fond de carte sans annonce préalable repérée | Documenté dans `frontend/.env.example` et le README ; clé `VITE_CARTO_API_KEY` recommandée |

---

## En cas de dérive constatée

- **Open-Meteo / Zippopotam / RainViewer** : voir l'issue `derive-contrat` ouverte
  automatiquement, corriger le schéma Zod concerné dans `backend/src/schemas/`.
- **OpenWeatherMap / CARTO** : mettre à jour ce document (tableau ci-dessus), puis évaluer si le
  repli existant (message d'indisponibilité, filigrane visible) reste acceptable ou si un
  changement de fournisseur devient nécessaire.
