import crypto from 'crypto';
import { prisma } from './prisma';

const REFRESH_TOKEN_BYTES = 40;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** SHA-256 is fine here (unlike password hashing): the input is a 320-bit
 *  random value, not something an attacker can brute-force from a dictionary. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return raw;
}

/**
 * Validates a refresh token and rotates it: the presented token is revoked
 * and a fresh one is issued in the same call. Rotation means a refresh token
 * can only ever be used once -- if a stolen token is replayed after the
 * legitimate client has already rotated past it, the lookup fails because
 * it's already revoked, which is itself a signal of theft.
 */
export async function rotateRefreshToken(
  rawToken: string
): Promise<{ userId: string; newToken: string } | null> {
  const tokenHash = hashToken(rawToken);
  const existing = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    return null;
  }

  await prisma.refreshToken.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
  const newToken = await issueRefreshToken(existing.userId);
  return { userId: existing.userId, newToken };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
