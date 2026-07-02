import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    testTimeout: 15000,
    // Integration tests share one Postgres connection pool; running them
    // concurrently risks cross-test row collisions during cleanup.
    fileParallelism: false,
  },
});
