import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createSubscriptionSchema, updateSubscriptionSchema } from '../validators/subscription.validator';

const router = Router();

router.use(authenticate);

router.get('/', subscriptionController.getSubscriptions);
router.get('/summary', subscriptionController.getSubscriptionSummary);
router.post('/', validate(createSubscriptionSchema), subscriptionController.createSubscription);
router.put('/:id', validate(updateSubscriptionSchema), subscriptionController.updateSubscription);
router.delete('/:id', subscriptionController.deleteSubscription);

export default router;
