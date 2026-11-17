import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'"

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

export default defineConfig({
  plugins: [react(), previewDocsFallback],
  // CSP в dev не включаем: Vite впрыскивает inline-скрипт HMR, который
  // блокируется script-src 'self'. В проде заголовки задаёт nginx.
  server: { proxy: { '/api': 'http://127.0.0.1:8000', '/openapi.json': 'http://127.0.0.1:8000' } },
  preview: {
    headers: securityHeaders,
    proxy: { '/api': 'http://127.0.0.1:8000', '/openapi.json': 'http://127.0.0.1:8000' },
  },
})
