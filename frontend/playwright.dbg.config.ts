import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', testMatch: 'dbg.spec.ts',
  use: { baseURL: 'http://127.0.0.1:8080', browserName: 'chromium' },
  workers: 1, reporter: 'list',
})
