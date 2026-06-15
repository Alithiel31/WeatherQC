import express from 'express';
import cors from 'cors';

import { globalErrorHandler } from './middlewares/global-error-handler.js';
import villesRouter from './routers/villes.router.js';
import previsionsRouter from './routers/previsions.router.js';
import geocodeRouter from './routers/geocode.router.js';

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://100.109.50.124:5173', 'http://100.109.50.124'],
}));
app.use(express.json());

app.use('/api', villesRouter);
app.use('/api', previsionsRouter);
app.use('/api', geocodeRouter);

app.get('/api/sante', (_req, res) => {
  res.json({ statut: 'ok' });
});

app.use(globalErrorHandler);

export default app;
