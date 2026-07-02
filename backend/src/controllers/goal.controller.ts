import { Response } from 'express';
import { AuthRequest } from '../types';
import * as goalService from '../services/goal.service';

export async function getGoals(req: AuthRequest, res: Response) {
  const goals = await goalService.getGoals(req.user!.userId);
  res.json({ success: true, data: goals });
}

export async function createGoal(req: AuthRequest, res: Response) {
  const goal = await goalService.createGoal(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: goal });
}

export async function updateGoal(req: AuthRequest, res: Response) {
  const goal = await goalService.updateGoal(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: goal });
}

export async function deleteGoal(req: AuthRequest, res: Response) {
  await goalService.deleteGoal(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Goal deleted' });
}
