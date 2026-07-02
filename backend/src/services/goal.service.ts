import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateGoalInput, UpdateGoalInput } from '../validators/goal.validator';

export async function getGoals(userId: string) {
  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { targetDate: 'asc' },
  });
  return goals.map(serializeGoal);
}

export async function createGoal(userId: string, input: CreateGoalInput) {
  const goal = await prisma.goal.create({
    data: {
      userId,
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
      targetAmount: input.targetAmount,
      currentAmount: input.currentAmount ?? 0,
      targetDate: new Date(input.targetDate),
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
      ...(input.targetAmount !== undefined && { targetAmount: input.targetAmount }),
      ...(input.currentAmount !== undefined && { currentAmount: input.currentAmount }),
      ...(input.targetDate && { targetDate: new Date(input.targetDate) }),
      ...(input.isCompleted !== undefined && { isCompleted: input.isCompleted }),
    },
  });
  return serializeGoal(goal);
}

export async function deleteGoal(userId: string, id: string) {
  const existing = await prisma.goal.findFirst({ where: { id, userId } });
  if (!existing) throw createError('Goal not found', 404);
  await prisma.goal.delete({ where: { id } });
}

function serializeGoal(goal: Record<string, unknown>) {
  return {
    ...goal,
    targetAmount: Number((goal as { targetAmount: { toString(): string } }).targetAmount),
    currentAmount: Number((goal as { currentAmount: { toString(): string } }).currentAmount),
  };
}
