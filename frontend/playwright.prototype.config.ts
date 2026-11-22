import { defineConfig } from '@playwright/test'

const production = process.env.PROTOTYPE_MODE === 'preview'
const port = Number(process.env.PROTOTYPE_PORT || (production ? 4174 : 4173))
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PROTOTYPE_PORT должен быть целым числом от 1 до 65535')
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
  webServer: process.env.PROTOTYPE_URL ? undefined : {
    command: `npx vite ${production ? 'preview' : ''} --host 127.0.0.1 --port ${port} --strictPort`,
    url: `${localUrl}/prototype`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
