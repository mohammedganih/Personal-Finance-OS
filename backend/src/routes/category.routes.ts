import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import * as categoryService from '../services/category.service';
import { AuthRequest } from '../types';
import { Response } from 'express';

const router = Router();

router.use(authenticate);

router.get('/', async (req: AuthRequest, res: Response) => {
  const categories = await categoryService.getCategories(req.user!.userId);
  res.json({ success: true, data: categories });
});

export default router;
