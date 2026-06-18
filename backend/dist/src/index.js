import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { zodErrorHandler } from './middlewares/zod-error-handler.js';
import { globalErrorHandler } from './middlewares/global-error-handler.js';
import villesRouter from './routers/villes.router.js';
import previsionsRouter from './routers/previsions.router.js';
import geocodeRouter from './routers/geocode.router.js';
const app = express();
const allowedOrigins = [
    'http://localhost:5173',
    ...(config.tailscaleIp
        ? [`http://${config.tailscaleIp}:5173`, `http://${config.tailscaleIp}`]
        : []),
];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
app.use('/api', villesRouter);
app.use('/api', previsionsRouter);
app.use('/api', geocodeRouter);
app.get('/api/sante', (_req, res) => {
    res.json({ statut: 'ok' });
});
app.use(zodErrorHandler);
app.use(globalErrorHandler);
export default app;
