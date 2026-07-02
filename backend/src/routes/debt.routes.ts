import { Router } from 'express';
import * as debtController from '../controllers/debt.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/health-score', debtController.getHealthScore);
router.get('/strategy', debtController.getStrategy);
router.get('/prepayment', debtController.getPrepayment);
router.get('/calendar', debtController.getCalendar);
router.get('/recommendations', debtController.getRecommendations);

export default router;
