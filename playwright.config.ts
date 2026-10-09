import { defineConfig } from '@playwright/test'

/** E2E drives the built Electron app (`npm run test:e2e` builds first) on the real OS. */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' }
})
