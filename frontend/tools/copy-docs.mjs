// Keep API documentation offline and compatible with the application's CSP.
import { copyFile, mkdir } from 'node:fs/promises'

const source = new URL('../node_modules/swagger-ui-dist/', import.meta.url)
const target = new URL('../public/docs/', import.meta.url)
await mkdir(target, { recursive: true })
await Promise.all([
  ['swagger-ui-bundle.js', 'swagger-ui-bundle.js'],
  ['swagger-ui.css', 'swagger-ui.css'],
  ['LICENSE', 'swagger-ui-LICENSE.txt'],
].map(([from, to]) => copyFile(new URL(from, source), new URL(to, target))))
