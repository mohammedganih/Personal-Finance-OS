import { Router } from 'express';
import * as goalController from '../controllers/goal.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createGoalSchema, updateGoalSchema } from '../validators/goal.validator';

const router = Router();

router.use(authenticate);

router.get('/', goalController.getGoals);
router.post('/', validate(createGoalSchema), goalController.createGoal);
router.put('/:id', validate(updateGoalSchema), goalController.updateGoal);
router.delete('/:id', goalController.deleteGoal);

export default router;
