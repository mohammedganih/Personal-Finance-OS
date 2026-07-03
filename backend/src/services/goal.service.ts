import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateGoalInput, UpdateGoalInput, CreateGoalContributionInput } from '../validators/goal.validator';

const MEMBER_SELECT = { select: { id: true, name: true, color: true, emoji: true } };

export async function getGoals(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    include: {
      member: MEMBER_SELECT,
      fundingAccount: { select: { id: true, name: true, type: true } },
    },
    orderBy: { targetDate: 'asc' },
  });
  return goals.map(serializeGoal);
}

export async function getGoal(userId: string, id: string) {
  const goal = await prisma.goal.findFirst({
    where: { id, userId },
    include: {
      member: MEMBER_SELECT,
      fundingAccount: { select: { id: true, name: true, type: true } },
    },
  });
  if (!goal) throw createError('Goal not found', 404);
  return serializeGoal(goal);
}

export async function createGoal(userId: string, input: CreateGoalInput) {
  const goal = await prisma.goal.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
      goalType: input.goalType,
      priority: input.priority,
      targetAmount: input.targetAmount,
      currentAmount: input.currentAmount ?? 0,
      targetDate: new Date(input.targetDate),
      monthlyContribution: input.monthlyContribution,
      expectedReturnRate: input.expectedReturnRate,
      expectedInflationRate: input.expectedInflationRate,
      riskLevel: input.riskLevel,
      fundingAccountId: input.fundingAccountId,
      memberId: input.memberId,
      notes: input.notes,
    },
    include: {
      member: MEMBER_SELECT,
      fundingAccount: { select: { id: true, name: true, type: true } },
    },
  });
  return serializeGoal(goal);
}

export async function updateGoal(userId: string, id: string, input: UpdateGoalInput) {
  const existing = await prisma.goal.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Goal not found', 404);

  const goal = await prisma.goal.update({
    where: { id },
    data: {
      ...(input.name && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.goalType !== undefined && { goalType: input.goalType }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.targetAmount !== undefined && { targetAmount: input.targetAmount }),
      ...(input.currentAmount !== undefined && { currentAmount: input.currentAmount }),
      ...(input.targetDate && { targetDate: new Date(input.targetDate) }),
      ...(input.monthlyContribution !== undefined && { monthlyContribution: input.monthlyContribution }),
      ...(input.expectedReturnRate !== undefined && { expectedReturnRate: input.expectedReturnRate }),
      ...(input.expectedInflationRate !== undefined && { expectedInflationRate: input.expectedInflationRate }),
      ...(input.riskLevel !== undefined && { riskLevel: input.riskLevel }),
      ...(input.fundingAccountId !== undefined && { fundingAccountId: input.fundingAccountId ?? null }),
      ...(input.memberId !== undefined && { memberId: input.memberId ?? null }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.isCompleted !== undefined && { isCompleted: input.isCompleted, status: input.isCompleted ? 'COMPLETED' : 'ACTIVE' }),
    },
    include: {
      member: MEMBER_SELECT,
      fundingAccount: { select: { id: true, name: true, type: true } },
    },
  });
  return serializeGoal(goal);
}

export async function deleteGoal(userId: string, id: string) {
  const existing = await prisma.goal.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Goal not found', 404);
  await prisma.goal.delete({ where: { id } });
}

// ── Contributions ────────────────────────────────────────────────────────────

export async function getContributions(userId: string, goalId: string) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw createError('Goal not found', 404);

  return prisma.goalContribution.findMany({
    where: { goalId },
    orderBy: { date: 'desc' },
  }).then((rows) => rows.map((r) => ({ ...r, amount: Number(r.amount) })));
}

/**
 * Logs a contribution AND rolls it into the goal's currentAmount atomically
 * -- the ledger and the running total must never drift apart.
 */
export async function createContribution(userId: string, goalId: string, input: CreateGoalContributionInput) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw createError('Goal not found', 404);

  const [contribution] = await prisma.$transaction([
    prisma.goalContribution.create({
      data: { goalId, userId, amount: input.amount, date: new Date(input.date), type: input.type, notes: input.notes },
    }),
    prisma.goal.update({
      where: { id: goalId },
      data: { currentAmount: { increment: input.amount } },
    }),
  ]);

  return { ...contribution, amount: Number(contribution.amount) };
}

export async function deleteContribution(userId: string, goalId: string, contributionId: string) {
  const goal = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!goal) throw createError('Goal not found', 404);

  const contribution = await prisma.goalContribution.findFirst({ where: { id: contributionId, goalId } });
  if (!contribution) throw createError('Contribution not found', 404);

  await prisma.$transaction([
    prisma.goalContribution.delete({ where: { id: contributionId } }),
    prisma.goal.update({
      where: { id: goalId },
      data: { currentAmount: { decrement: contribution.amount } },
    }),
  ]);
}

function serializeGoal(goal: Record<string, unknown>) {
  return {
    ...goal,
    targetAmount: Number((goal as { targetAmount: { toString(): string } }).targetAmount),
    currentAmount: Number((goal as { currentAmount: { toString(): string } }).currentAmount),
    monthlyContribution: goal.monthlyContribution ? Number(goal.monthlyContribution as { toString(): string }) : null,
    expectedReturnRate: goal.expectedReturnRate ? Number(goal.expectedReturnRate as { toString(): string }) : null,
    expectedInflationRate: goal.expectedInflationRate ? Number(goal.expectedInflationRate as { toString(): string }) : null,
  };
}
