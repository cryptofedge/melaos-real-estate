import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list']],

  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
  },

  // Real engines, not just narrow viewports: iPhone and iPad run WebKit, which is
  // what every browser on iOS actually uses, and it diverges from Chromium.
  projects: [
    { name: 'desktop-chrome',  use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-safari',  use: { ...devices['Desktop Safari'] } },
    { name: 'iphone',          use: { ...devices['iPhone 14'] } },
    { name: 'iphone-landscape', use: { ...devices['iPhone 14 landscape'] } },
    { name: 'android',         use: { ...devices['Pixel 7'] } },
    { name: 'ipad',            use: { ...devices['iPad (gen 7)'] } },
    { name: 'android-tablet',  use: { ...devices['Galaxy Tab S4'] } },
  ],

  // The site is static: serve the folder as-is, exactly as Pages does.
  // Windows ships `python`, Linux and the CI runners ship `python3`.
  webServer: {
    command: `${process.platform === 'win32' ? 'python' : 'python3'} -m http.server 8080 --bind 127.0.0.1`,
    url: 'http://127.0.0.1:8080/index.html',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
