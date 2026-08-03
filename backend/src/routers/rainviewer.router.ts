import { Router } from 'express';
import rainviewerController from '../controllers/rainviewer.controller.js';

const router = Router();

router.get('/rainviewer', rainviewerController.getFrames);

export default router;
