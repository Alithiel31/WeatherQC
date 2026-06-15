# Météo Québec · Montréal

Application de prévisions météo : backend **Node.js / Express** + frontend **Svelte (PWA)**.
Données fournies par [Open-Meteo](https://open-meteo.com) (gratuit, sans clé API).

## Fonctionnalités

- Conditions actuelles (température, ressenti, vent, humidité)
- Prévisions **heure par heure sur 48 h** et quotidiennes (7 jours)
- **Carte animée des nuages** (satellite infrarouge) et du **radar des précipitations** via RainViewer + Leaflet, avec lecture/pause et curseur temporel
- **Recherche par code postal québécois** (G, H, J) : géocodage de la RTA (3 premiers caractères, précision quartier) via Zippopotam, puis prévisions localisées
- Bascule Montréal ↔ Québec (choix mémorisé)
- Ciel dynamique : le dégradé d'arrière-plan suit les conditions et le jour/nuit
- PWA installable, fonctionne hors ligne (dernières prévisions en cache)
- Cache serveur 10 min pour limiter les appels à Open-Meteo
- Interface entièrement en français

## Démarrage

### 1. Backend (port 3001)

```bash
cd backend
npm install
npm start        # ou: npm run dev (rechargement auto)
```

Routes :
- `GET /api/villes` — liste des villes
- `GET /api/previsions/montreal` ou `/api/previsions/quebec`
- `GET /api/geocode/H2X` — géocode un code postal québécois (RTA)
- `GET /api/previsions-coordonnees?lat=45.5&lon=-73.6&nom=Plateau` — prévisions pour un point
- `GET /api/sante` — vérification

### 2. Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Ouvrir http://localhost:5173 — le proxy Vite redirige `/api` vers le backend.

### Production

```bash
cd frontend && npm run build   # génère dist/ avec le service worker
```

Servir `frontend/dist` derrière le même domaine que l'API (ou ajuster le proxy).
Le service worker met l'application en cache et garde les prévisions
disponibles hors ligne (stratégie *network-first*, 6 h max).

## Structure

```
meteo-qc/
├── backend/
│   └── server.js          # Express + proxy Open-Meteo + cache mémoire
└── frontend/
    ├── vite.config.js     # Vite + vite-plugin-pwa (manifest, service worker)
    └── src/
        ├── App.svelte     # Ville active, ciel dynamique, conditions actuelles
        └── lib/
            ├── Horaire.svelte    # Bandeau heure par heure (48 h)
            ├── CarteNuages.svelte # Carte Leaflet animée (RainViewer)
            ├── Quotidien.svelte  # Liste 7 jours avec barres min–max
            └── meteo.js          # Codes WMO → libellés FR, icônes, dates
```

## Ajouter une ville

Ajouter une entrée dans l'objet `CITIES` de `backend/server.js` et dans le
tableau `villes` de `frontend/src/App.svelte`.

## Notes sur la précision du code postal

Un code postal complet (6 caractères) n'est pas géocodable avec un service
gratuit ; l'application utilise la **RTA** (les 3 premiers caractères,
ex. `H2X`), ce qui localise au quartier près — largement suffisant pour la
météo, dont la résolution des modèles est de quelques kilomètres.

## Services externes utilisés (tous gratuits, sans clé)

- **Open-Meteo** — prévisions
- **Zippopotam.us** — géocodage des RTA canadiennes
- **RainViewer** — images satellites (nuages) et radar animés
- **CARTO / OpenStreetMap** — fond de carte
