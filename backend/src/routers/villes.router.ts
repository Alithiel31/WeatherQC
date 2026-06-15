import { Router } from 'express';
import villesController from '../controllers/villes.controller.js';

const router = Router();

router.get('/villes', villesController.getAll);

export default router;
