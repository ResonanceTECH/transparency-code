import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// JSON в public остаётся единственным образцом. Vite получает его как модуль,
// не пытаясь импортировать статический /public URL из браузера.
const sampleFiles: Record<string, string> = {
  'virtual:resonance-profile-sample': fileURLToPath(new URL('./public/samples/profile.json', import.meta.url)),
  'virtual:resonance-document-samples': fileURLToPath(new URL('./public/samples/documents.json', import.meta.url))
}
const syntheticSamples: Plugin = {
  name: 'synthetic-profile-samples',
  resolveId(id) {
    if (Object.hasOwn(sampleFiles, id)) return `\0${id}`
  },
  load(id) {
    if (!id.startsWith('\0')) return
    const file = sampleFiles[id.slice(1)]
    if (!file) return
    this.addWatchFile(file)
    return `export default ${readFileSync(file, 'utf8')};`
  },
  handleHotUpdate({ file, server }) {
    const entry = Object.entries(sampleFiles).find(([, path]) => path.replace(/\\/g, '/') === file.replace(/\\/g, '/'))
    if (!entry) return
    const module = server.moduleGraph.getModuleById(`\0${entry[0]}`)
    return module ? [module] : []
  }
}

const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"

const securityHeaders = {
  'Content-Security-Policy': csp,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
}

const previewDocsFallback: Plugin = {
  name: 'preview-docs-fallback',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const request = req as { url?: string }
      if (!request.url?.startsWith('/api/')) {
        for (const [name, value] of Object.entries(securityHeaders)) res.setHeader(name, value)
      }
      if (request.url?.startsWith('/samples/')) {
        // Только учебные вложения разрешено показывать внутри нашего приложения.
        res.setHeader('X-Frame-Options', 'SAMEORIGIN')
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'; object-src 'none'; base-uri 'none'")
      }
      if (request.url === '/docs') {
        // Как в nginx: /docs → /docs/, иначе relative-пути Swagger
        // разрешаются от корня и страница получает SPA вместо документации.
        res.writeHead(302, { Location: '/docs/' })
        res.end()
        return
      }
      if (request.url === '/docs/') request.url = '/docs/index.html'
      next()
    })
  },
}

// Автотесты проксируют API на изолированный backend через VITE_API_TARGET.
const apiTarget = process.env.VITE_API_TARGET || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), syntheticSamples, previewDocsFallback],
  // CSP в dev не включаем: Vite впрыскивает inline-скрипт HMR, который
  // блокируется script-src 'self'. В проде заголовки задаёт nginx.
  server: { proxy: { '/api': apiTarget, '/openapi.json': apiTarget } },
  preview: {
    proxy: { '/api': apiTarget, '/openapi.json': apiTarget },
  },
})
