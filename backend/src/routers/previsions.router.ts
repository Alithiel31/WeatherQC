import { Router } from 'express';
import previsionsController from '../controllers/previsions.controller.js';

const router = Router();

router.get('/previsions/:ville', previsionsController.getByVille);
router.get('/previsions-coordonnees', previsionsController.getByCoordonnees);

export default router;
