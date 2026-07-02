import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { resetDatabase, prisma } from '../test/db';
import * as authService from './auth.service';

beforeEach(resetDatabase);
afterAll(() => prisma.$disconnect());

describe('auth.service', () => {
  describe('register', () => {
    it('creates a user with a hashed password and seeds default categories', async () => {
      const { user, token } = await authService.register({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(user.email).toBe('test@example.com');
      expect(token).toBeTruthy();

      const stored = await prisma.user.findUnique({ where: { id: user.id } });
      expect(stored?.passwordHash).not.toBe('Password123'); // never store plaintext
      expect(stored?.passwordHash.length).toBeGreaterThan(20); // looks hashed

      const categories = await prisma.category.findMany({ where: { userId: user.id } });
      expect(categories.length).toBe(authService.DEFAULT_CATEGORIES.length);
      expect(categories.every((c) => c.isDefault)).toBe(true);
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

      const { user, token } = await authService.login({ email: 'login@example.com', password: 'Password123' });
      expect(user.email).toBe('login@example.com');
      expect(token).toBeTruthy();
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
});
