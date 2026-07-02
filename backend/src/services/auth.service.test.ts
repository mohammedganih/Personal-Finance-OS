import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('auth.service', () => {
  describe('register', () => {
    it('creates a user with a hashed password, seeds default categories, and issues both tokens', async () => {
      const { user, accessToken, refreshToken } = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(user.email).toBe('test@example.com');
      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();

      const stored = await prisma.user.findUnique({ where: { id: user.id } });
      expect(stored?.passwordHash).not.toBe('Password123'); // never store plaintext
      expect(stored?.passwordHash.length).toBeGreaterThan(20); // looks hashed

      const categories = await prisma.category.findMany({ where: { userId: user.id } });
      expect(categories.length).toBe(authService.DEFAULT_CATEGORIES.length);
      expect(categories.every((c) => c.isDefault)).toBe(true);

      // The raw refresh token is never stored -- only its hash.
      const storedRefresh = await prisma.refreshToken.findMany({ where: { userId: user.id } });
      expect(storedRefresh).toHaveLength(1);
      expect(storedRefresh[0].tokenHash).not.toBe(refreshToken);
    });

    it('rejects a duplicate email', async () => {
      await authService.register({ name: 'First', email: 'dup@example.com', password: 'Password123' });

      await expect(
        authService.register({ name: 'Second', email: 'dup@example.com', password: 'Password123' })
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('login', () => {
    it('succeeds with the correct password', async () => {
      await authService.register({ name: 'Test User', email: 'login@example.com', password: 'Password123' });

      const { user, accessToken, refreshToken } = await authService.login({
        email: 'login@example.com',
        password: 'Password123',
      });
      expect(user.email).toBe('login@example.com');
      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();
    });

    it('rejects an unknown email', async () => {
      await expect(
        authService.login({ email: 'nobody@example.com', password: 'Password123' })
      ).rejects.toMatchObject({ status: 401 });
    });

    it('rejects the wrong password', async () => {
      await authService.register({ name: 'Test User', email: 'wrongpw@example.com', password: 'Password123' });

      await expect(
        authService.login({ email: 'wrongpw@example.com', password: 'NotThePassword1' })
      ).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('refresh', () => {
    it('issues a new access token and rotates the refresh token', async () => {
      const { refreshToken: original } = await authService.register({
        name: 'Test User', email: 'refresh@example.com', password: 'Password123',
      });

      const { accessToken, refreshToken: rotated } = await authService.refresh(original);
      expect(accessToken).toBeTruthy();
      expect(rotated).toBeTruthy();
      expect(rotated).not.toBe(original); // must be a different token, not reused
    });

    it('rejects reuse of an already-rotated refresh token', async () => {
      const { refreshToken: original } = await authService.register({
        name: 'Test User', email: 'reuse@example.com', password: 'Password123',
      });

      await authService.refresh(original); // first use rotates it

      await expect(authService.refresh(original)).rejects.toMatchObject({ status: 401 });
    });

    it('rejects an unknown token', async () => {
      await expect(authService.refresh('not-a-real-token')).rejects.toMatchObject({ status: 401 });
    });
  });

  describe('logout', () => {
    it('revokes the refresh token so it can no longer be used', async () => {
      const { refreshToken } = await authService.register({
        name: 'Test User', email: 'logout@example.com', password: 'Password123',
      });

      await authService.logout(refreshToken);

      await expect(authService.refresh(refreshToken)).rejects.toMatchObject({ status: 401 });
    });

    it('is a no-op when no token is provided', async () => {
      await expect(authService.logout(undefined)).resolves.toBeUndefined();
    });
  });
});
