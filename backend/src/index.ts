import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';

import { zodErrorHandler } from './middlewares/zod-error-handler.js';
import { globalErrorHandler } from './middlewares/global-error-handler.js';
import { limiteurApi, limiteurGeocode } from './middlewares/rate-limit.js';
import { requestId } from './middlewares/request-id.js';
import { journalAcces } from './middlewares/acces.js';
import { statistiquesCache } from './services/cache.service.js';
import { etatDisjoncteurs } from './lib/breaker.js';

import villesRouter from './routers/villes.router.js';
import previsionsRouter from './routers/previsions.router.js';
import geocodeRouter from './routers/geocode.router.js';
import rainviewerRouter from './routers/rainviewer.router.js';

const app = express();

// L'API est jointe via cloudflared puis nginx : sans ceci, toutes les requêtes
// portent l'IP du conteneur nginx et la limitation de débit bannirait tout le
// monde d'un coup. Voir TRUST_PROXY_HOPS dans le README.
app.set('trust proxy', config.trustProxyHops);

// Avant tout le reste : même une requête rejetée par le quota doit être traçable.
app.use(requestId);
// Juste après, pour que la durée mesurée couvre bien toute la chaîne — y compris
// les rejets du limiteur, jusqu'ici absents des logs.
app.use(journalAcces);

app.use(helmet());

// Le domaine public n'y figurait pas : en production nginx proxifie `/api/` en
// same-origin, donc aucune requête ne portait d'en-tête `Origin` et l'oubli
// restait invisible. Tout client servi depuis un autre hôte aurait été bloqué
// sans message exploitable. `PUBLIC_ORIGINS` le déclare explicitement.
const allowedOrigins = [
  'http://localhost:5173',
  ...(config.tailscaleIp
    ? [`http://${config.tailscaleIp}:5173`, `http://${config.tailscaleIp}`]
    : []),
  ...config.publicOrigins,
];

app.use(cors({ origin: allowedOrigins }));
// Aucune route n'attend de corps volumineux : plafond bas.
app.use(express.json({ limit: '10kb' }));

// Déclarée avant les limiteurs : le healthcheck Docker interroge cette route
// toutes les 30 s et ne doit jamais consommer de quota.
//
// Elle ne rendait que `{ statut: 'ok' }` — vrai, mais inexploitable. Le contenu
// ci-dessous est ce qu'on veut lire quand l'application « rame » sans qu'on
// sache si la faute revient au Raspberry Pi ou à un fournisseur. Aucune donnée
// personnelle, rien qu'on ne puisse exposer publiquement.
app.get('/api/sante', (_req, res) => {
  res.json({
    statut: 'ok',
    versionNode: process.version,
    demarreDepuisS: Math.round(process.uptime()),
    memoireMo: Math.round(process.memoryUsage().rss / 1024 / 1024),
    cache: statistiquesCache(),
    amonts: etatDisjoncteurs(),
  });
});

app.use('/api', limiteurApi);
app.use('/api/geocode', limiteurGeocode);

app.use('/api', villesRouter);
app.use('/api', previsionsRouter);
app.use('/api', geocodeRouter);
app.use('/api', rainviewerRouter);

app.use(zodErrorHandler);
app.use(globalErrorHandler);

export default app;
