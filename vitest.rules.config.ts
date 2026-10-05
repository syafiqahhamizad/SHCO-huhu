import { defineConfig } from 'vitest/config';

// Firestore rules tests: need the Firestore emulator (`npm run test:rules`, run in CI).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.spec.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
