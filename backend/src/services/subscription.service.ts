import { BillingCycle, Subscription } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateSubscriptionInput, UpdateSubscriptionInput } from '../validators/subscription.validator';

const BILLING_MULTIPLIERS: Record<BillingCycle, number> = {
  MONTHLY: 1,
  QUARTERLY: 1 / 3,
  HALF_YEARLY: 1 / 6,
  YEARLY: 1 / 12,
};

export async function getSubscriptions(userId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    orderBy: { renewalDate: 'asc' },
  });
  return subscriptions.map(serializeSubscription);
}

export async function createSubscription(userId: string, input: CreateSubscriptionInput) {
  const subscription = await prisma.subscription.create({
    data: {
      userId,
      serviceName: input.serviceName,
      amount: input.amount,
      billingCycle: input.billingCycle,
      renewalDate: new Date(input.renewalDate),
      category: input.category,
      url: input.url || null,
      notes: input.notes,
    },
  });
  return serializeSubscription(subscription);
}

export async function updateSubscription(userId: string, id: string, input: UpdateSubscriptionInput) {
  const existing = await prisma.subscription.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Subscription not found', 404);

  const subscription = await prisma.subscription.update({
    where: { id },
    data: {
      ...(input.serviceName && { serviceName: input.serviceName }),
      ...(input.amount !== undefined && { amount: input.amount }),
      ...(input.billingCycle && { billingCycle: input.billingCycle }),
      ...(input.renewalDate && { renewalDate: new Date(input.renewalDate) }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.url !== undefined && { url: input.url || null }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
  return serializeSubscription(subscription);
}

export async function deleteSubscription(userId: string, id: string) {
  const existing = await prisma.subscription.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Subscription not found', 404);
  await prisma.subscription.delete({ where: { id } });
}

export async function getSubscriptionSummary(userId: string) {
  const subscriptions = await prisma.subscription.findMany({
    where: { userId, isActive: true },
    orderBy: { renewalDate: 'asc' },
  });

  const subs = subscriptions.map(serializeSubscription);
  const monthlyCost = subs.reduce((sum, s) => {
    return sum + s.amount * (BILLING_MULTIPLIERS[s.billingCycle] ?? 1);
  }, 0);

  const upcoming = subs
    .filter((s) => {
      const days = Math.ceil((new Date(s.renewalDate).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 30;
    })
    .slice(0, 5);

  return { subscriptions: subs, monthlyCost, annualCost: monthlyCost * 12, upcoming };
}

function serializeSubscription(sub: Subscription) {
  return { ...sub, amount: Number(sub.amount) };
}
