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
assert.deepEqual(Object.keys(model.services).sort(), ['app', 'gateway', 'postgres'])
const { app, postgres, gateway } = model.services
assert.equal(app.environment.HOST, '0.0.0.0')
assert.equal(app.ports?.length || 0, 0)
assert.equal(gateway.ports.length, 1)
assert.equal(gateway.ports[0].host_ip, '0.0.0.0')
assert.equal(String(gateway.ports[0].published), '8080')
assert.equal(gateway.ports[0].target, 8080)
assert.equal(postgres.ports?.length || 0, 0)
assert.equal(app.depends_on.postgres.condition, 'service_healthy')
for (const service of [app, postgres, gateway]) {
  assert.equal(service.restart, 'unless-stopped')
  assert.ok(service.healthcheck.test.length)
  assert.notEqual(service.network_mode, 'host')
}
assert.ok(postgres.volumes.some((volume) => volume.type === 'volume' && volume.source === 'postgres_data' && volume.target === '/var/lib/postgresql/data'))
assert.ok(model.volumes.postgres_data)
assert.deepEqual(app.command, ['node', 'scripts/start-container.mjs'])
assert.equal(model.networks.runtime.internal, true)
assert.equal(model.networks.frontend.internal, true)
assert.deepEqual(Object.keys(app.networks).sort(), ['frontend', 'runtime'])
assert.deepEqual(Object.keys(postgres.networks), ['runtime'])
assert.deepEqual(Object.keys(gateway.networks).sort(), ['edge', 'frontend'])
assert.equal(gateway.pull_policy, 'never')
assert.ok(gateway.image.includes('@sha256:'))
assert.equal(gateway.read_only, true)
assert.ok(gateway.cap_drop.includes('ALL'))
assert.equal(app.pull_policy, 'never')
assert.equal(postgres.pull_policy, 'never')
assert.ok(postgres.image.includes('@sha256:'))
assert.equal(app.read_only, true)
assert.ok(app.cap_drop.includes('ALL'))
console.log('Compose OK: gateway :8080, app/DB sin puertos publicados, redes internas, volumen, healthchecks. Egress del gateway requiere docker-egress-policy.sh en host Linux. (No ejecuta Docker Engine.)')
