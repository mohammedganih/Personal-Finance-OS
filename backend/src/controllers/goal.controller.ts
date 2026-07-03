import { Response } from 'express';
import { AuthRequest } from '../types';
import * as goalService from '../services/goal.service';
import * as goalIntelligenceService from '../services/goalIntelligence.service';

export async function getGoals(req: AuthRequest, res: Response) {
  const goals = await goalService.getGoals(req.user!.userId);
  res.json({ success: true, data: goals });
}

export async function getGoal(req: AuthRequest, res: Response) {
  const goal = await goalService.getGoal(req.user!.userId, req.params.id);
  res.json({ success: true, data: goal });
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

export async function getContributions(req: AuthRequest, res: Response) {
  const contributions = await goalService.getContributions(req.user!.userId, req.params.id);
  res.json({ success: true, data: contributions });
}

export async function createContribution(req: AuthRequest, res: Response) {
  const contribution = await goalService.createContribution(req.user!.userId, req.params.id, req.body);
  res.status(201).json({ success: true, data: contribution });
}

export async function deleteContribution(req: AuthRequest, res: Response) {
  await goalService.deleteContribution(req.user!.userId, req.params.id, req.params.contributionId);
  res.json({ success: true, message: 'Contribution deleted' });
}

export async function getGoalProgress(req: AuthRequest, res: Response) {
  const progress = await goalIntelligenceService.getGoalProgress(req.user!.userId, req.params.id);
  res.json({ success: true, data: progress });
}

export async function getGoalProbability(req: AuthRequest, res: Response) {
  const probability = await goalIntelligenceService.getGoalProbability(req.user!.userId, req.params.id);
  res.json({ success: true, data: probability });
}

export async function getGoalScenarios(req: AuthRequest, res: Response) {
  const scenarios = await goalIntelligenceService.getGoalScenarios(req.user!.userId, req.params.id);
  res.json({ success: true, data: scenarios });
}

export async function getGoalMilestones(req: AuthRequest, res: Response) {
  const milestones = await goalIntelligenceService.getGoalMilestones(req.user!.userId, req.params.id);
  res.json({ success: true, data: milestones });
}

export async function getGoalRecommendations(req: AuthRequest, res: Response) {
  const recommendations = await goalIntelligenceService.getGoalRecommendations(req.user!.userId, req.params.id);
  res.json({ success: true, data: recommendations });
}

export async function getGoalInsights(req: AuthRequest, res: Response) {
  const insights = await goalIntelligenceService.getGoalInsights(req.user!.userId);
  res.json({ success: true, data: insights });
}
