import { Response } from 'express';
import { AuthRequest } from '../types';
import * as cardEMIService from '../services/card-emi.service';

export async function getCardEMIs(req: AuthRequest, res: Response) {
  const includeArchived = req.query.archived === 'true';
  const emis = await cardEMIService.getCardEMIs(req.user!.userId, includeArchived);
  res.json({ success: true, data: emis });
}

export async function getCardEMIsForCard(req: AuthRequest, res: Response) {
  const emis = await cardEMIService.getCardEMIsForCard(req.user!.userId, req.params.cardId);
  res.json({ success: true, data: emis });
}

export async function getSummary(req: AuthRequest, res: Response) {
  const summary = await cardEMIService.getCardEMISummary(req.user!.userId);
  res.json({ success: true, data: summary });
}

export async function createCardEMI(req: AuthRequest, res: Response) {
  const emi = await cardEMIService.createCardEMI(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: emi });
}

export async function updateCardEMI(req: AuthRequest, res: Response) {
  const emi = await cardEMIService.updateCardEMI(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: emi });
}

export async function deleteCardEMI(req: AuthRequest, res: Response) {
  await cardEMIService.deleteCardEMI(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Card EMI deleted' });
}

export async function payCardEMI(req: AuthRequest, res: Response) {
  const { accountId } = req.body as { accountId?: string };
  const result = await cardEMIService.payCardEMI(req.user!.userId, req.params.id, accountId);
  res.json({ success: true, data: result });
}
