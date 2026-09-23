import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'

// Parses the real Compose model without starting containers or using local secrets.
// COMPOSE_CLI can point to the official standalone binary for offline-engine checks.
const env = { ...process.env, POSTGRES_PASSWORD: 'configuration-check-only' }
for (const key of ['APP_BIND_ADDRESS', 'APP_PORT', 'POSTGRES_DB', 'POSTGRES_USER', 'COMPOSE_FILE', 'COMPOSE_PROJECT_NAME', 'COMPOSE_PROFILES']) delete env[key]
const args = ['--env-file', '.env.example', '-f', 'docker-compose.yml', 'config', '--format', 'json']
const result = spawnSync(process.env.COMPOSE_CLI || 'docker', process.env.COMPOSE_CLI ? args : ['compose', ...args], { env, encoding: 'utf8' })
if (result.error || result.status !== 0) throw new Error('No se pudo validar Compose. Instalar Docker/Compose o indicar COMPOSE_CLI (binario oficial).')
const model = JSON.parse(result.stdout)
assert.deepEqual(Object.keys(model.services).sort(), ['app', 'postgres'])
const { app, postgres } = model.services
assert.equal(app.environment.HOST, '0.0.0.0')
assert.equal(app.ports.length, 1)
assert.equal(app.ports[0].host_ip, '0.0.0.0')
assert.equal(String(app.ports[0].published), '8080')
assert.equal(app.ports[0].target, 3001)
assert.equal(postgres.ports?.length || 0, 0)
assert.equal(app.depends_on.postgres.condition, 'service_healthy')
for (const service of [app, postgres]) {
  assert.equal(service.restart, 'unless-stopped')
  assert.ok(service.healthcheck.test.length)
  assert.notEqual(service.network_mode, 'host')
}
assert.ok(postgres.volumes.some((volume) => volume.type === 'volume' && volume.source === 'postgres_data' && volume.target === '/var/lib/postgresql/data'))
assert.ok(model.volumes.postgres_data)
assert.deepEqual(app.command, ['node', 'scripts/start-container.mjs'])
console.log('Compose OK: app 0.0.0.0:8080, PostgreSQL sin puerto publicado, volumen persistente, healthchecks y restart policies. (No ejecuta Docker Engine.)')
