import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'

// Creates a NEW, isolated audit stack. Never point this at a production project.
if (!process.argv.includes('--run')) throw new Error('Usage: node scripts/test-offline.mjs --run (requires preloaded images, Docker and free port 18080)')
const project = 'lc1c-offline-audit'
const env = { ...process.env, POSTGRES_DB: 'lc1c_offline_test', POSTGRES_USER: 'audit', POSTGRES_PASSWORD: 'disposable-offline-test-only', APP_PORT: '18080', APP_BIND_ADDRESS: '127.0.0.1', EDGE_BRIDGE_NAME: 'lc1c-audit-e', FRONTEND_BRIDGE_NAME: 'lc1c-audit-f', RUNTIME_BRIDGE_NAME: 'lc1c-audit-r' }
const args = ['compose', '--env-file', '.env.example', '-f', 'docker-compose.yml', '-p', project]
const evidence = { date: new Date().toISOString(), project, checks: [], limitations: ['No browser automation; complete browser matrix and packet capture in OFFLINE_VERIFICATION.md.', 'TCP deny probes are not proof of absence of DNS/UDP traffic.'] }
function docker(extra) {
  const r = spawnSync('docker', [...args, ...extra], { env, encoding: 'utf8', maxBuffer: 10e6 })
  if (r.status !== 0) throw new Error(`docker ${extra[0]} failed (see Docker locally); no production resources changed`)
  return r.stdout.trim()
}
function check(name, fn) { const value = fn(); evidence.checks.push({ name, status: 'PASS', value }); return value }
const base = 'http://127.0.0.1:18080'
async function api(path, body, revision, method = 'POST') {
  const r = await fetch(base + '/api/rex' + path, body ? { method, headers: { 'Content-Type': 'application/json', 'If-Match': String(revision) }, body: JSON.stringify(body) } : undefined)
  assert.ok(r.ok, `HTTP ${r.status}`); return r.json()
}
async function healthy() {
  for (let i = 0; i < 90; i++) {
    try { if ((await fetch(base + '/api/health')).ok) return } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error('Health timeout')
}
try {
  const model = JSON.parse(docker(['config', '--format', 'json']))
  check('internal-network', () => assert.equal(model.networks.runtime.internal, true))
  check('postgres-not-published', () => assert.equal(model.services.postgres.ports?.length || 0, 0))
  const existing = docker(['ps', '-aq'])
  assert.equal(existing, '', 'Audit project already exists; inspect it and explicitly remove it before running again')
  for (const bridge of [env.EDGE_BRIDGE_NAME, env.FRONTEND_BRIDGE_NAME, env.RUNTIME_BRIDGE_NAME]) check(`scoped-egress-firewall-${bridge}`, () => {
    const r = spawnSync('bash', ['scripts/docker-egress-policy.sh', bridge], { encoding: 'utf8' })
    assert.equal(r.status, 0, `Run on Linux Docker host as root: ${r.stderr}`)
    return r.stdout.trim()
  })
  docker(['up', '-d', '--no-build', '--pull', 'never'])
  await healthy()
  check('gateway-port-published', () => {
    const id = docker(['ps', '-q', 'gateway'])
    const r = spawnSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', id], { encoding: 'utf8' })
    assert.equal(r.status, 0)
    const bindings = JSON.parse(r.stdout)['8080/tcp']
    assert.ok(bindings?.some(p => p.HostIp === '127.0.0.1' && p.HostPort === '18080'),
      'Docker did not publish 127.0.0.1:18080. An internal-only network can retain PortBindings without creating a host mapping; do not remove isolation to bypass this failure.')
    return bindings
  })
  evidence.checks.push({ name: 'startup-with-internal-network-and-no-pull', status: 'PASS' })
  for (const name of ['app', 'postgres', 'gateway']) check(`${name}-network-membership`, () => {
    const id = docker(['ps', '-q', name])
    const r = spawnSync('docker', ['inspect', '--format', '{{json .NetworkSettings.Networks}}', id], { encoding: 'utf8' })
    assert.equal(r.status, 0); const networks = Object.keys(JSON.parse(r.stdout)).sort()
    const expected = { app: ['frontend', 'runtime'], postgres: ['runtime'], gateway: ['edge', 'frontend'] }[name].map(n => `${project}_${n}`).sort()
    assert.deepEqual(networks, expected); return networks
  })
  check('app-external-tcp-blocked', () => docker(['exec', '-T', 'app', 'node', '-e', `const net=require('net');const s=net.connect({host:'1.1.1.1',port:443});s.setTimeout(3000);s.on('connect',()=>{console.error('UNEXPECTED EGRESS');s.destroy();process.exit(1)});s.on('timeout',()=>{s.destroy();console.log('blocked/timeout')});s.on('error',()=>console.log('blocked/error'));`]))
  check('gateway-external-tcp-blocked', () => docker(['exec', '-T', 'gateway', 'sh', '-c', 'if nc -z -w 3 1.1.1.1 443; then exit 1; else echo blocked; fi']))
  const html = await (await fetch(base)).text()
  const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1])
  for (const asset of assets) {
    const url = new URL(asset, base); assert.equal(url.origin, base)
    assert.ok((await fetch(url)).ok, `Missing asset ${url.pathname}`)
  }
  evidence.checks.push({ name: 'html-entry-assets', status: 'PASS', count: assets.length })
  let state = await api('/state')
  const eventName = `OFFLINE AUDIT ${Date.now()}`
  state = await api('/events', { name: eventName, type: 'REX', status: 'OPEN' }, state.revision)
  const id = state.id
  state = await api(`/events/${id}`, { name: eventName + ' updated', type: 'REX', status: 'CLOSED' }, state.revision, 'PUT')
  assert.ok(state.events.some(e => e.id === id && e.name === eventName + ' updated'))
  check('postgres-direct-persistence', () => {
    const sql = `SELECT count(*) FROM "RexEvent" WHERE name='${eventName} updated';`
    const result = docker(['exec', '-T', 'postgres', 'psql', '-U', 'audit', '-d', 'lc1c_offline_test', '-tAc', sql]); assert.equal(result, '1'); return result
  })
  docker(['restart', 'postgres', 'app']); await healthy()
  assert.ok((await api('/state')).events.some(e => e.id === id))
  evidence.checks.push({ name: 'restart-read-persistence', status: 'PASS' })
  console.log('PASS automated subset. Audit stack retained for browser/packet-capture checks; production untouched.')
} catch (e) { evidence.checks.push({ name: 'execution', status: 'FAIL', message: e.message }); console.error(e.message); process.exitCode = 1 }
finally { mkdirSync('tmp/security', { recursive: true }); writeFileSync('tmp/security/offline-result.json', JSON.stringify(evidence, null, 2)) }
