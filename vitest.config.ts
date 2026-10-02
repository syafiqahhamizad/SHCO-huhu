import { defineConfig } from 'vitest/config';

// Date-bucketing tests assume the firm's time zone (UTC+8). Set it before any worker starts so
// every `new Date()` in the suites sees Asia/Kuala_Lumpur, whatever the CI runner's zone is.
process.env.TZ = 'Asia/Kuala_Lumpur';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: { TZ: 'Asia/Kuala_Lumpur' },
  },
});
