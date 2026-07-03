import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { signAccessToken } from '../lib/jwt';
import { issueRefreshToken, rotateRefreshToken, revokeRefreshToken } from '../lib/refreshToken';
import { RegisterInput, LoginInput } from '../validators/auth.validator';
import { createError } from '../middleware/error.middleware';

export const DEFAULT_CATEGORIES = [
  { name: 'Salary',        icon: '💰', color: '#10B981', type: 'INCOME'  as const },
  { name: 'Freelance',     icon: '💻', color: '#3B82F6', type: 'INCOME'  as const },
  { name: 'Business',      icon: '🏢', color: '#8B5CF6', type: 'INCOME'  as const },
  { name: 'Investments',   icon: '📈', color: '#F59E0B', type: 'INCOME'  as const },
  { name: 'Other Income',  icon: '💵', color: '#6B7280', type: 'INCOME'  as const },
  { name: 'Food & Dining', icon: '🍽️', color: '#EF4444', type: 'EXPENSE' as const },
  { name: 'Groceries',     icon: '🛒', color: '#22C55E', type: 'EXPENSE' as const },
  { name: 'Transportation',icon: '🚗', color: '#F97316', type: 'EXPENSE' as const },
  { name: 'Shopping',      icon: '🛍️', color: '#EC4899', type: 'EXPENSE' as const },
  { name: 'Entertainment', icon: '🎮', color: '#8B5CF6', type: 'EXPENSE' as const },
  { name: 'Healthcare',    icon: '🏥', color: '#14B8A6', type: 'EXPENSE' as const },
  { name: 'Electricity',   icon: '⚡', color: '#EAB308', type: 'EXPENSE' as const },
  { name: 'Internet',      icon: '🌐', color: '#06B6D4', type: 'EXPENSE' as const },
  { name: 'Utilities',     icon: '🔧', color: '#F59E0B', type: 'EXPENSE' as const },
  { name: 'Rent',          icon: '🏠', color: '#3B82F6', type: 'EXPENSE' as const },
  { name: 'Education',     icon: '📚', color: '#06B6D4', type: 'EXPENSE' as const },
  { name: 'Travel',        icon: '✈️', color: '#10B981', type: 'EXPENSE' as const },
  { name: 'Personal Care', icon: '💆', color: '#A855F7', type: 'EXPENSE' as const },
  { name: 'Subscriptions',       icon: '📱', color: '#6366F1', type: 'EXPENSE' as const },
  { name: 'Investment',          icon: '📈', color: '#F59E0B', type: 'EXPENSE' as const },
  { name: 'Loan EMI',            icon: '🏦', color: '#F97316', type: 'EXPENSE' as const },
  { name: 'Wealth Creation',     icon: '🏡', color: '#22C55E', type: 'EXPENSE' as const },
  { name: 'Credit Card Bill',    icon: '💳', color: '#EF4444', type: 'EXPENSE' as const },
  { name: 'Card EMI',            icon: '📦', color: '#8B5CF6', type: 'EXPENSE' as const },
  { name: 'Other',               icon: '📦', color: '#6B7280', type: 'EXPENSE' as const },
];

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw createError('Email already registered', 409);

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      categories: {
        create: DEFAULT_CATEGORIES.map((cat) => ({ ...cat, isDefault: true })),
      },
    },
    select: { id: true, email: true, name: true, currency: true, createdAt: true },
  });

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);
  return { user, accessToken, refreshToken };
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw createError('Invalid email or password', 401);

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw createError('Invalid email or password', 401);

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  const refreshToken = await issueRefreshToken(user.id);
  const { passwordHash: _, ...safeUser } = user;
  return { user: safeUser, accessToken, refreshToken };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, currency: true, createdAt: true, updatedAt: true },
  });
  if (!user) throw createError('User not found', 404);
  return user;
}

export async function refresh(rawRefreshToken: string) {
  const result = await rotateRefreshToken(rawRefreshToken);
  if (!result) throw createError('Invalid or expired refresh token', 401);

  const user = await prisma.user.findUnique({ where: { id: result.userId }, select: { id: true, email: true } });
  if (!user) throw createError('User not found', 404);

  const accessToken = signAccessToken({ userId: user.id, email: user.email });
  return { accessToken, refreshToken: result.newToken };
}

export async function logout(rawRefreshToken: string | undefined) {
  if (rawRefreshToken) await revokeRefreshToken(rawRefreshToken);
}
