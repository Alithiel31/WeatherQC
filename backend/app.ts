import app from './src/index.js';
import { config } from './src/config.js';
import { startCacheSweeper } from './src/services/cache.service.js';

// Démarré ici et non à l'import du module de cache : les tests importent
// `src/index.js` sans devoir composer avec un timer en arrière-plan.
startCacheSweeper();

app.listen(config.port, () => {
  console.log(`API météo démarrée sur http://localhost:${config.port}`);
});
