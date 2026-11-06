import { Response } from 'express';
import { AuthRequest } from '../types';
import * as investmentService from '../services/investment.service';

export async function getInvestments(req: AuthRequest, res: Response) {
  const result = await investmentService.getInvestments(req.user!.userId);
  res.json({ success: true, data: result });
}

export async function getPortfolioSummary(req: AuthRequest, res: Response) {
  const result = await investmentService.getPortfolioSummary(req.user!.userId);
  res.json({ success: true, data: result });
}

export async function createInvestment(req: AuthRequest, res: Response) {
  const investment = await investmentService.createInvestment(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: investment });
}

export async function updateInvestment(req: AuthRequest, res: Response) {
  const investment = await investmentService.updateInvestment(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: investment });
}

export async function deleteInvestment(req: AuthRequest, res: Response) {
  await investmentService.deleteInvestment(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Investment deleted' });
}

export async function payInvestment(req: AuthRequest, res: Response) {
  const { accountId } = req.body as { accountId?: string };
  const result = await investmentService.payInvestment(req.user!.userId, req.params.id, accountId);
  res.json({ success: true, data: result });
}
