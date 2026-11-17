import { defineConfig } from '@playwright/test'

const port = Number(process.env.PROTOTYPE_PORT || 4173)
const localUrl = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './tests',
  testMatch: 'visual.spec.ts',
  outputDir: './test-results/visual',
  use: {
    baseURL: process.env.PROTOTYPE_URL || localUrl,
    browserName: 'chromium',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure'
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',
  workers: 1,
  reporter: 'list',
  expect: { toHaveScreenshot: { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.02 } },
  webServer: process.env.PROTOTYPE_URL
    ? undefined
    : {
        command: `npx vite --host 127.0.0.1 --port ${port} --strictPort`,
        url: `${localUrl}/prototype`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000
      }
})
