import { Response } from 'express';
import { AuthRequest } from '../types';
import * as debtService from '../services/debtIntelligence.service';

export async function getCalendar(req: AuthRequest, res: Response) {
  const monthsAhead = req.query.months ? parseInt(req.query.months as string, 10) : 3;
  const result = await debtService.getEMICalendar(req.user!.userId, Math.min(Math.max(monthsAhead, 1), 12));
  res.json({ success: true, data: result });
}

