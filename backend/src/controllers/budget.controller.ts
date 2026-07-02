import { Response } from 'express';
import { AuthRequest } from '../types';
import * as budgetService from '../services/budget.service';

export async function getBudgets(req: AuthRequest, res: Response) {
  const budgets = await budgetService.getBudgets(req.user!.userId);
  res.json({ success: true, data: budgets });
}

export async function createBudget(req: AuthRequest, res: Response) {
  const budget = await budgetService.createBudget(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: budget });
}

export async function updateBudget(req: AuthRequest, res: Response) {
  const budget = await budgetService.updateBudget(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: budget });
}

export async function deleteBudget(req: AuthRequest, res: Response) {
  await budgetService.deleteBudget(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Budget deleted' });
}
