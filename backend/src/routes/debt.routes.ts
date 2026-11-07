import { Router } from 'express';
import * as debtController from '../controllers/debt.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/calendar', debtController.getCalendar);

export default router;
