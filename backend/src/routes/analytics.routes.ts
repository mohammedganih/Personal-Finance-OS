import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/spending-rhythm', analyticsController.getSpendingRhythm);
router.get('/financial-score', analyticsController.getFinancialScore);

export default router;
