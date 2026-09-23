import { db } from './db'
import { createApp } from './app'

const port = Number(process.env.PORT || 3001)
const host = process.env.HOST || '127.0.0.1'
await db.$connect()
const server = createApp(db, process.env.STATIC_DIR || 'dist-spares').listen(port, host, () => console.log(`Repuestos Críticos: http://${host}:${port} (PostgreSQL)`))
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => { void db.$disconnect().then(() => process.exit(0)) }))
