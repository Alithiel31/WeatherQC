import { Router } from 'express';
import geocodeController from '../controllers/geocode.controller.js';

const router = Router();

router.get('/geocode/:codePostal', geocodeController.geocodeRTA);

export default router;
