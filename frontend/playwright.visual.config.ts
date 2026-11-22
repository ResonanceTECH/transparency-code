import { defineConfig } from '@playwright/test'

const apiPort = 8124
const port = 4176
const localUrl = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  testMatch: 'visual.spec.ts',
  outputDir: './test-results/visual',
  use: {
    baseURL: process.env.PROTOTYPE_URL || localUrl,
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure'
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  workers: 1,
  reporter: 'list',
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.02 } },
  webServer: process.env.PROTOTYPE_URL
    ? undefined
    : [
        {
          command: `node tools/test-stack.mjs --port ${apiPort} --stack-id visual`,
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
      ]
})
