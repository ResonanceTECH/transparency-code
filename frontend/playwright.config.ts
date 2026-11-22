import { defineConfig } from '@playwright/test'

// Сквозные сценарии против изолированного стека backend 8125 + vite 4177.
const apiPort = 8125
const port = 4177
const localUrl = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  testMatch: 'flow.spec.ts',
  outputDir: './test-results/e2e',
  use: { baseURL: process.env.E2E_URL || localUrl, browserName: 'chromium', viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure' },
  workers: 1,
  reporter: 'list',
  webServer: process.env.E2E_URL ? undefined : [
    {
      command: `node tools/test-stack.mjs --port ${apiPort} --stack-id e2e`,
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
      url: `${localUrl}/prototype`,
      env: { VITE_API_TARGET: `http://127.0.0.1:${apiPort}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
})
