import { afterEach, describe, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createUuid } from '../src/spares/domain/createUuid'

afterEach(() => vi.unstubAllGlobals())
describe('IDs de Repuestos en HTTP por IP', () => {
  it('utiliza randomUUID cuando está disponible', () => {
    const randomUUID = vi.fn(() => '00000000-0000-4000-8000-000000000001')
    vi.stubGlobal('crypto', { randomUUID })
    expect(createUuid()).toBe('00000000-0000-4000-8000-000000000001')
    expect(randomUUID).toHaveBeenCalledOnce()
  })
  it('sin randomUUID genera UUID v4 criptográficos únicos con getRandomValues', () => {
    vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) })
    const ids = Array.from({ length: 1000 }, () => createUuid())
    expect(new Set(ids).size).toBe(1000)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('sin criptografía falla claramente en vez de generar IDs débiles', () => {
    vi.stubGlobal('crypto', undefined)
    expect(createUuid).toThrow('navegador actualizado')
  })
  it('los puntos de alta usan la abstracción única y la API usa URLs relativas', () => {
    for (const file of ['src/spares/CriticalSparesApp.tsx', 'src/spares/store/criticalSparesStore.ts']) {
      const source = readFileSync(file, 'utf8')
      expect(source).toContain('createUuid()')
      expect(source).not.toContain('crypto.randomUUID(')
    }
    const repository = readFileSync('src/spares/repositories/HttpCriticalSparesRepository.ts', 'utf8')
    expect(repository).toContain("private base = '/api'")
    expect(repository).not.toMatch(/localhost|127\.0\.0\.1/)
  })
})
