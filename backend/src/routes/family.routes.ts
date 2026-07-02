import { Router } from 'express';
import * as familyController from '../controllers/family.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createFamilyMemberSchema, updateFamilyMemberSchema } from '../validators/family.validator';

const router = Router();
router.use(authenticate);

router.get('/',           familyController.getMembers);
router.get('/analytics',  familyController.getMemberAnalytics);
router.get('/strategy',   familyController.getLoanStrategy);
router.post('/',   validate(createFamilyMemberSchema), familyController.createMember);
router.put('/:id', validate(updateFamilyMemberSchema), familyController.updateMember);
router.delete('/:id',     familyController.deleteMember);

export default router;
