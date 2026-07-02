import { P2PLoan } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { createError } from '../middleware/error.middleware';
import { CreateP2PInput, UpdateP2PInput } from '../validators/p2p.validator';

export async function getP2PLoans(userId: string) {
  const loans = await prisma.p2PLoan.findMany({
    where: { userId },
    orderBy: [{ isSettled: 'asc' }, { date: 'desc' }],
  });
  return loans.map(serialize);
}

export async function createP2PLoan(userId: string, input: CreateP2PInput) {
  const loan = await prisma.p2PLoan.create({
    data: {
      userId,
      personName:     input.personName,
      type:           input.type,
      amount:         input.amount,
      remainingAmount: input.remainingAmount,
      date:           new Date(input.date),
      dueDate:        input.dueDate ? new Date(input.dueDate) : null,
      description:    input.description,
      notes:          input.notes,
    },
  });
  return serialize(loan);
}

export async function updateP2PLoan(userId: string, id: string, input: UpdateP2PInput) {
  const existing = await prisma.p2PLoan.findFirst({ where: { id, userId } });
  if (!existing) throw createError('P2P loan not found', 404);

  const loan = await prisma.p2PLoan.update({
    where: { id },
    data: {
      ...(input.personName      !== undefined && { personName: input.personName }),
      ...(input.type            !== undefined && { type: input.type }),
      ...(input.amount          !== undefined && { amount: input.amount }),
      ...(input.remainingAmount !== undefined && { remainingAmount: input.remainingAmount }),
      ...(input.date            !== undefined && { date: new Date(input.date) }),
      ...(input.dueDate         !== undefined && { dueDate: input.dueDate ? new Date(input.dueDate) : null }),
      ...(input.description     !== undefined && { description: input.description }),
      ...(input.notes           !== undefined && { notes: input.notes }),
      ...(input.isSettled       !== undefined && { isSettled: input.isSettled }),
    },
  });
  return serialize(loan);
}

export async function deleteP2PLoan(userId: string, id: string) {
  const existing = await prisma.p2PLoan.findFirst({ where: { id, userId } });
  if (!existing) throw createError('P2P loan not found', 404);
  await prisma.p2PLoan.delete({ where: { id } });
}

export async function getP2PSummary(userId: string) {
  const loans = await prisma.p2PLoan.findMany({ where: { userId, isSettled: false } });
  const totalLent     = loans.filter(l => l.type === 'LENT').reduce((s, l) => s + Number(l.remainingAmount), 0);
  const totalBorrowed = loans.filter(l => l.type === 'BORROWED').reduce((s, l) => s + Number(l.remainingAmount), 0);
  return { totalLent, totalBorrowed, net: totalLent - totalBorrowed };
}

function serialize(loan: P2PLoan) {
  return {
    ...loan,
    amount:          Number(loan.amount),
    remainingAmount: Number(loan.remainingAmount),
  };
}
