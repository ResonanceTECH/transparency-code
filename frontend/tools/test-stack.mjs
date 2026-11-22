// Изолированный backend для Playwright: чистая SQLite, миграции, учебные сиды.
// Запуск: node tools/test-stack.mjs --port 8123 --stack-id prototype
// TEST_DATABASE_URL задает внешнюю PostgreSQL вместо SQLite, базу выбирать выделенную,
// стек прогоняет миграции и добавляет учебные сиды в указанную базу.
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const args = process.argv.slice(2)
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : args[index + 1]
}
const port = arg('port', '8123')
const stackId = arg('stack-id', 'default')

const frontendDir = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const backendDir = path.resolve(frontendDir, '..', 'backend')
const stackDir = path.join(frontendDir, '.pw-stack', stackId)
const databasePath = path.join(stackDir, 'test.db')
const uploadDir = path.join(stackDir, 'uploads')

const candidates = process.platform === 'win32'
  ? [path.join(backendDir, '.venv', 'Scripts', 'python.exe'), 'python']
  : [path.join(backendDir, '.venv', 'bin', 'python'), 'python3']
const python = candidates.find((item) => existsSync(item)) || candidates.at(-1)

rmSync(stackDir, { recursive: true, force: true })
mkdirSync(uploadDir, { recursive: true })

const databaseUrl = process.env.TEST_DATABASE_URL
  ?? `sqlite+aiosqlite:///${databasePath.replaceAll('\\', '/')}`
const databaseLabel = databaseUrl.startsWith('sqlite') ? `SQLite ${databasePath}` : 'PostgreSQL (TEST_DATABASE_URL)'

const env = {
  ...process.env,
  DATABASE_URL: databaseUrl,
  UPLOAD_DIR: uploadDir,
  ENVIRONMENT: 'development',
  ALLOW_DEMO_LOGIN: 'true',
  SEED_TEST_USERS: 'true',
  SECRET_KEY: 'playwright-stack',
}

const migrate = spawnSync(python, ['-m', 'alembic', 'upgrade', 'head'], {
  cwd: backendDir, env, stdio: 'inherit',
})
if (migrate.status !== 0) {
  console.error(`[test-stack] alembic upgrade head завершился с кодом ${migrate.status}`)
  process.exit(migrate.status ?? 1)
}

const server = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', port], {
  cwd: backendDir, env, stdio: 'inherit',
})
console.log(`[test-stack] backend ${stackId} на http://127.0.0.1:${port} (${databaseLabel})`)

const shutdown = () => { if (!server.killed) server.kill('SIGTERM') }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { shutdown(); process.exit(0) })
process.on('exit', shutdown)
server.on('exit', (code) => { console.error(`[test-stack] backend остановился (код ${code})`); process.exit(code ?? 1) })
