import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Server } from 'node:http'
import type { PrismaClient } from '@prisma/client'
import { createApp } from '../server/app'

describe('HTTP hardening', () => {
  let server: Server; let base: string
  beforeAll(async () => {
    server = createApp({} as PrismaClient, 'dist-spares').listen(0, '127.0.0.1')
    await new Promise<void>((r) => server.on('listening', r))
    base = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  })
  afterAll(async () => { await new Promise<void>((r) => server.close(() => r())) })
  it('same-origin CSP and security headers cover HTML and API', async () => {
    for (const path of ['/', '/api/unknown']) {
      const r = await fetch(base + path)
      expect(r.headers.get('content-security-policy')).toContain("connect-src 'self' blob:")
      expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
      expect(r.headers.get('x-frame-options')).toBe('DENY')
      expect(r.headers.get('referrer-policy')).toBe('no-referrer')
      expect(r.headers.get('x-content-type-options')).toBe('nosniff')
      expect(r.headers.get('access-control-allow-origin')).toBeNull()
      expect(r.headers.get('x-powered-by')).toBeNull()
    }
  })
  it('rejects malformed/null/foreign origins without stack traces', async () => {
    for (const origin of ['null', 'invalid', 'https://foreign.invalid']) {
      const r = await fetch(base + '/api/config', { method: 'PUT', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}' })
      expect(r.status).toBe(403); expect(await r.text()).not.toContain('stack')
    }
  })
  it('rejects cross-site and simple form writes', async () => {
    expect((await fetch(base + '/api/config', { method: 'PUT', headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403)
    expect((await fetch(base + '/api/config', { method: 'PUT', headers: { 'Content-Type': 'text/plain' }, body: '{}' })).status).toBe(415)
  })
  it('same-origin clients still reach revision validation', async () => {
    expect((await fetch(base + '/api/config', { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(428)
  })
})
