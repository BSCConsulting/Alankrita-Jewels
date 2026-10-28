import { defineConfig, devices } from '@playwright/test'

const PORT = 4181
const CI = Boolean(process.env.CI)

/**
 * End-to-end tests against a production build in demo mode (no Supabase variables, so the in-browser demo
 * database, test OTP and simulated payment are used). Run with `npm run e2e`.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    // Playwright's bundled Chromium needs macOS 13+; locally, the installed Chrome is used instead.
    channel: CI ? undefined : 'chrome',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'], channel: CI ? undefined : 'chrome' } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: CI ? undefined : 'chrome' } },
  ],
  webServer: {
    command: `npx vite build --mode e2e && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  },
})
