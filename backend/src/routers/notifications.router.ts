import { Router } from 'express';
import notificationsController from '../controllers/notifications.controller.js';

const router = Router();

router.get('/notifications/cle-publique', notificationsController.clePublique);
router.post('/notifications/abonnement', notificationsController.sAbonner);
router.delete('/notifications/abonnement', notificationsController.seDesabonner);

export default router;
