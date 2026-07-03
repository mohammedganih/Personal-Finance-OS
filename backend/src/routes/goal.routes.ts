import { Router } from 'express';
import * as goalController from '../controllers/goal.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createGoalSchema, updateGoalSchema, createGoalContributionSchema } from '../validators/goal.validator';

const router = Router();

router.use(authenticate);

router.get('/', goalController.getGoals);
router.get('/insights', goalController.getGoalInsights);
router.post('/', validate(createGoalSchema), goalController.createGoal);

router.get('/:id', goalController.getGoal);
router.put('/:id', validate(updateGoalSchema), goalController.updateGoal);
router.delete('/:id', goalController.deleteGoal);

router.get('/:id/progress', goalController.getGoalProgress);
router.get('/:id/probability', goalController.getGoalProbability);
router.get('/:id/scenarios', goalController.getGoalScenarios);
router.get('/:id/milestones', goalController.getGoalMilestones);
router.get('/:id/recommendations', goalController.getGoalRecommendations);

router.get('/:id/contributions', goalController.getContributions);
router.post('/:id/contributions', validate(createGoalContributionSchema), goalController.createContribution);
router.delete('/:id/contributions/:contributionId', goalController.deleteContribution);

export default router;
