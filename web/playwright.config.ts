import { defineConfig, devices } from '@playwright/test';

const webServerCommand =
  process.env.PLAYWRIGHT_WEB_SERVER_COMMAND ||
  'npm run dev -- --hostname 127.0.0.1 --port 3000';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Don't start a web server, backend should already be running
    command: webServerCommand,
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
