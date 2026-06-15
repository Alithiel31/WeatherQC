import app from './src/index.js';
import { config } from './src/config.js';

app.listen(config.port, () => {
  console.log(`API météo démarrée sur http://localhost:${config.port}`);
});
