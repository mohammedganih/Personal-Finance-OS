import { Response } from 'express';
import { AuthRequest } from '../types';
import * as subscriptionService from '../services/subscription.service';

export async function getSubscriptions(req: AuthRequest, res: Response) {
  const subs = await subscriptionService.getSubscriptions(req.user!.userId);
  res.json({ success: true, data: subs });
}

export async function getSubscriptionSummary(req: AuthRequest, res: Response) {
  const summary = await subscriptionService.getSubscriptionSummary(req.user!.userId);
  res.json({ success: true, data: summary });
}

export async function createSubscription(req: AuthRequest, res: Response) {
  const sub = await subscriptionService.createSubscription(req.user!.userId, req.body);
  res.status(201).json({ success: true, data: sub });
}

export async function updateSubscription(req: AuthRequest, res: Response) {
  const sub = await subscriptionService.updateSubscription(req.user!.userId, req.params.id, req.body);
  res.json({ success: true, data: sub });
}

export async function deleteSubscription(req: AuthRequest, res: Response) {
  await subscriptionService.deleteSubscription(req.user!.userId, req.params.id);
  res.json({ success: true, message: 'Subscription deleted' });
}
