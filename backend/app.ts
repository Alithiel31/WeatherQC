import app from './src/index.js';
import { config } from './src/config.js';
import { startCacheSweeper, stopCacheSweeper } from './src/services/cache.service.js';

// Démarré ici et non à l'import du module de cache : les tests importent
// `src/index.js` sans devoir composer avec un timer en arrière-plan.
startCacheSweeper();

const server = app.listen(config.port, () => {
  console.log(`API météo démarrée sur http://localhost:${config.port}`);
});

const DELAI_ARRET_FORCE_MS = 10_000;

// `docker compose up -d --build` envoie SIGTERM : sans ceci, les requêtes en
// vol sont coupées net.
function arreter(signal: NodeJS.Signals): void {
  console.log(`${signal} reçu — arrêt en cours…`);
  stopCacheSweeper();

  server.close((erreur) => {
    if (erreur) {
      console.error("Erreur pendant l'arrêt", erreur);
      process.exit(1);
    }
    console.log('Arrêt propre terminé.');
    process.exit(0);
  });

  // Filet de sécurité si une connexion refuse de se fermer.
  setTimeout(() => {
    console.error('Arrêt forcé après expiration du délai de grâce.');
    process.exit(1);
  }, DELAI_ARRET_FORCE_MS).unref();
}

process.on('SIGTERM', arreter);
process.on('SIGINT', arreter);
