import { spawn } from 'node:child_process'

process.env.CHECKPOINT_DISABLE = '1'
process.env.PRISMA_HIDE_UPDATE_MESSAGE = '1'

const { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB } = process.env
if (!POSTGRES_PASSWORD || POSTGRES_PASSWORD === 'CHANGE_ME_BEFORE_START') throw new Error('Configurar una contraseña real en .env antes de iniciar')
process.env.DATABASE_URL = `postgresql://${encodeURIComponent(POSTGRES_USER)}:${encodeURIComponent(POSTGRES_PASSWORD)}@postgres:5432/${encodeURIComponent(POSTGRES_DB)}`
const migrate = spawn(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], { stdio: 'inherit' })
migrate.on('exit', (code) => {
  if (code !== 0) process.exit(code || 1)
  const app = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { stdio: 'inherit' })
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.kill(signal))
  app.on('exit', (status) => process.exit(status || 0))
})
