import { db } from './db'
import { createApp } from './app'
import { initializeCoverageHistory } from './sparesDatabase'
import { initializeRepairs } from './repairs/router'

const port = Number(process.env.PORT || 3001)
const host = process.env.HOST || '127.0.0.1'
await db.$connect()
await initializeCoverageHistory(db)
await initializeRepairs(db)
const server = createApp(db, process.env.STATIC_DIR || 'dist-spares').listen(port, host, () => console.log(`Mantenimiento LC1C: http://${host}:${port} (PostgreSQL)`))
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => { void db.$disconnect().then(() => process.exit(0)) }))
