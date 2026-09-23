import 'dotenv/config'
import { spawnSync } from 'node:child_process'

const url = process.env.TEST_DATABASE_URL
if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('TEST_DATABASE_URL debe apuntar a una base dedicada cuyo nombre termine en _test. Se reemplazarán datos SOLO de esa base.')
const env = { ...process.env, DATABASE_URL: url, RUN_POSTGRES_TESTS: '1' }
for (const args of [['node_modules/prisma/build/index.js', 'migrate', 'deploy'], ['node_modules/vitest/vitest.mjs', 'run', 'tests/server/postgres.test.ts', '--no-file-parallelism']]) {
  const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' })
  if (result.status !== 0) process.exit(result.status || 1)
}
