import { defineConfig } from '@playwright/test'

// Выделенные порты, чтобы прогон не цеплялся к dev-серверу разработчика:
// backend 8123 (чистая SQLite, tools/test-stack.mjs), vite 4175 с прокси на него.
const apiPort = 8123
const port = 4175
const localUrl = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  testMatch: ['profile.spec.ts', 'documents-print.spec.ts'],
  outputDir: './test-results/profile-v2',
  use: {
    baseURL: process.env.PROTOTYPE_URL || localUrl,
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  workers: 1,
  reporter: 'list',
  webServer: process.env.PROTOTYPE_URL ? undefined : [
    {
      command: `node tools/test-stack.mjs --port ${apiPort} --stack-id prototype`,
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
