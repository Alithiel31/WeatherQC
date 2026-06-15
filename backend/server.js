import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Villes supportées
// ---------------------------------------------------------------------------
const CITIES = {
  montreal: {
    id: "montreal",
    nom: "Montréal",
    latitude: 45.5019,
    longitude: -73.5674,
    timezone: "America/Toronto",
  },
  quebec: {
    id: "quebec",
    nom: "Québec",
    latitude: 46.8131,
    longitude: -71.2075,
    timezone: "America/Toronto",
  },
};

// ---------------------------------------------------------------------------
// Cache mémoire simple
// ---------------------------------------------------------------------------
const cache = new Map(); // clé -> { data, expires }

function getCached(key) {
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) return entry.data;
  cache.delete(key);
  return null;
}

function setCached(key, data, ttlMs) {
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

const TTL_PREVISIONS = 10 * 60 * 1000; // 10 minutes
const TTL_GEOCODE = 30 * 24 * 60 * 60 * 1000; // 30 jours (les RTA ne bougent pas)

// ---------------------------------------------------------------------------
// Appel Open-Meteo (gratuit, sans clé API)
// ---------------------------------------------------------------------------
async function fetchForecast({ latitude, longitude, timezone = "America/Toronto" }) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    timezone,
    current: [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "weather_code",
      "wind_speed_10m",
      "is_day",
    ].join(","),
    hourly: ["temperature_2m", "weather_code", "precipitation_probability"].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_probability_max",
      "sunrise",
      "sunset",
    ].join(","),
    forecast_days: "7",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo a répondu ${res.status}`);
  const raw = await res.json();

  const nowIndex = raw.hourly.time.findIndex(
    (t) => new Date(t) >= new Date(raw.current.time)
  );
  const start = Math.max(nowIndex, 0);

  return {
    misAJour: raw.current.time,
    actuel: {
      temperature: raw.current.temperature_2m,
      ressenti: raw.current.apparent_temperature,
      humidite: raw.current.relative_humidity_2m,
      vent: raw.current.wind_speed_10m,
      code: raw.current.weather_code,
      jour: raw.current.is_day === 1,
    },
    // 48 heures de prévisions heure par heure
    horaire: raw.hourly.time.slice(start, start + 48).map((t, i) => ({
      heure: t,
      temperature: raw.hourly.temperature_2m[start + i],
      code: raw.hourly.weather_code[start + i],
      precipitation: raw.hourly.precipitation_probability[start + i],
    })),
    quotidien: raw.daily.time.map((t, i) => ({
      date: t,
      code: raw.daily.weather_code[i],
      max: raw.daily.temperature_2m_max[i],
      min: raw.daily.temperature_2m_min[i],
      precipitation: raw.daily.precipitation_probability_max[i],
      lever: raw.daily.sunrise[i],
      coucher: raw.daily.sunset[i],
    })),
  };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.get("/api/villes", (_req, res) => {
  res.json(
    Object.values(CITIES).map(({ id, nom, latitude, longitude }) => ({
      id,
      nom,
      latitude,
      longitude,
    }))
  );
});

app.get("/api/previsions/:ville", async (req, res) => {
  const city = CITIES[req.params.ville];
  if (!city) {
    return res
      .status(404)
      .json({ erreur: "Ville inconnue. Villes disponibles : montreal, quebec." });
  }

  const cached = getCached(`prev:${city.id}`);
  if (cached) return res.json({ ...cached, depuisCache: true });

  try {
    const data = await fetchForecast(city);
    const payload = {
      ville: {
        id: city.id,
        nom: city.nom,
        latitude: city.latitude,
        longitude: city.longitude,
      },
      ...data,
    };
    setCached(`prev:${city.id}`, payload, TTL_PREVISIONS);
    res.json({ ...payload, depuisCache: false });
  } catch (err) {
    console.error(err);
    res.status(502).json({ erreur: "Impossible de récupérer les prévisions météo." });
  }
});

// ---------------------------------------------------------------------------
// Géocodage d'un code postal québécois (RTA : 3 premiers caractères)
// Les codes postaux du Québec commencent par G, H ou J.
// ---------------------------------------------------------------------------
const REGEX_RTA_QC = /^[GHJ]\d[A-Z]$/;

app.get("/api/geocode/:codePostal", async (req, res) => {
  const brut = req.params.codePostal.toUpperCase().replace(/\s+/g, "");
  const rta = brut.slice(0, 3);

  if (!/^[A-Z]\d[A-Z]/.test(rta)) {
    return res.status(400).json({
      erreur: "Format invalide. Exemple attendu : H2X ou G1R 4S9.",
    });
  }
  if (!REGEX_RTA_QC.test(rta)) {
    return res.status(400).json({
      erreur:
        "Ce code postal ne semble pas québécois (il doit commencer par G, H ou J).",
    });
  }

  const cached = getCached(`geo:${rta}`);
  if (cached) return res.json(cached);

  try {
    const r = await fetch(`https://api.zippopotam.us/ca/${rta}`);
    if (r.status === 404) {
      return res.status(404).json({ erreur: `Code postal introuvable : ${rta}.` });
    }
    if (!r.ok) throw new Error(`Zippopotam a répondu ${r.status}`);
    const data = await r.json();
    const place = data.places?.[0];
    if (!place) {
      return res.status(404).json({ erreur: `Aucun lieu trouvé pour ${rta}.` });
    }

    const resultat = {
      rta,
      nom: place["place name"],
      province: place.state,
      latitude: parseFloat(place.latitude),
      longitude: parseFloat(place.longitude),
    };
    setCached(`geo:${rta}`, resultat, TTL_GEOCODE);
    res.json(resultat);
  } catch (err) {
    console.error(err);
    res.status(502).json({ erreur: "Le service de géocodage est indisponible." });
  }
});

// ---------------------------------------------------------------------------
// Prévisions pour des coordonnées arbitraires (résultat du géocodage)
// ---------------------------------------------------------------------------
app.get("/api/previsions-coordonnees", async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);
  const nom = (req.query.nom || "Position personnalisée").toString().slice(0, 80);

  // Bornes larges autour du Québec
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < 44 ||
    lat > 63 ||
    lon < -80 ||
    lon > -56
  ) {
    return res.status(400).json({ erreur: "Coordonnées invalides ou hors du Québec." });
  }

  const cle = `prev:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = getCached(cle);
  if (cached) {
    return res.json({ ...cached, ville: { ...cached.ville, nom }, depuisCache: true });
  }

  try {
    const data = await fetchForecast({ latitude: lat, longitude: lon });
    const payload = {
      ville: { id: "personnalise", nom, latitude: lat, longitude: lon },
      ...data,
    };
    setCached(cle, payload, TTL_PREVISIONS);
    res.json({ ...payload, depuisCache: false });
  } catch (err) {
    console.error(err);
    res.status(502).json({ erreur: "Impossible de récupérer les prévisions météo." });
  }
});

app.get("/api/sante", (_req, res) => res.json({ statut: "ok" }));

app.listen(PORT, () => {
  console.log(`API météo démarrée sur http://localhost:${PORT}`);
});
