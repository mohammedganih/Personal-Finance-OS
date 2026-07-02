import { Response } from 'express';
import { AuthRequest } from '../types';
import * as familyService from '../services/family.service';
import { parsePeriod } from '../lib/period';

export async function getMembers(req: AuthRequest, res: Response) {
  const members = await familyService.getFamilyMembers(req.user!.userId);
  res.json({ success: true, data: members });
}

export async function createMember(req: AuthRequest, res: Response) {
  const member = await familyService.createFamilyMember(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: member });
}

export async function updateMember(req: AuthRequest, res: Response) {
  const member = await familyService.updateFamilyMember(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: member });
}

export async function deleteMember(req: AuthRequest, res: Response) {
  await familyService.deleteFamilyMember(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Member removed' });
}

export async function getMemberAnalytics(req: AuthRequest, res: Response) {
  const { month, year } = parsePeriod(req);
  const data = await familyService.getMemberAnalytics(req.user!.userId, month, year);
  res.json({ success: true, data });
}

export async function getLoanStrategy(req: AuthRequest, res: Response) {
  const data = await familyService.getLoanStrategy(req.user!.userId);
  res.json({ success: true, data });
}
