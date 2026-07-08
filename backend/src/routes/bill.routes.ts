import { Router } from 'express';
import * as billController from '../controllers/bill.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  bulkBillActionSchema,
  createBillSchema,
  pauseBillSchema,
  payBillOccurrenceSchema,
  skipBillOccurrenceSchema,
  undoBillOccurrenceSchema,
  updateBillSchema,
} from '../validators/bill.validator';

const router = Router();

router.use(authenticate);

// Aggregate views (registered before /:id so the ids don't shadow them)
router.get('/', billController.getBills);
router.get('/summary', billController.getBillsSummary);
router.get('/calendar', billController.getBillsCalendar);
router.get('/forecast', billController.getBillsForecast);
router.get('/insights', billController.getBillsInsights);
router.get('/analytics', billController.getBillsAnalytics);
router.get('/reminders', billController.getBillReminders);

// Bulk before /:id for the same reason
router.post('/bulk', validate(bulkBillActionSchema), billController.bulkAction);

router.get('/:id', billController.getBill);
router.post('/', validate(createBillSchema), billController.createBill);
router.put('/:id', validate(updateBillSchema), billController.updateBill);
router.delete('/:id', billController.deleteBill);

// Lifecycle & occurrence actions
router.post('/:id/duplicate', billController.duplicateBill);
router.post('/:id/pause', validate(pauseBillSchema), billController.pauseBill);
router.post('/:id/resume', billController.resumeBill);
router.post('/:id/pay', validate(payBillOccurrenceSchema), billController.payOccurrence);
router.post('/:id/skip', validate(skipBillOccurrenceSchema), billController.skipOccurrence);
router.post('/:id/undo', validate(undoBillOccurrenceSchema), billController.undoOccurrence);

export default router;
