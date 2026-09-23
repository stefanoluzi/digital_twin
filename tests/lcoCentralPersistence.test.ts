import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEmptyLcoCouplingData } from '../src/maintenance/domain/lcoCouplings'

afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('../src/maintenance/repositories/IndexedDbLcoCouplingsRepository'); vi.resetModules() })
describe('LCO cliente central sin fallback local', () => {
  const setup = async () => {
    const indexedDB = { open: vi.fn(() => { throw new Error('No usar IndexedDB operacional') }) }
    vi.stubGlobal('indexedDB', indexedDB)
    const data = createEmptyLcoCouplingData()
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data, revision: 0 }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const service = await import('../src/maintenance/services/lcoCentralService')
    const { useMaintenanceStore: store } = await import('../src/maintenance/store/maintenanceStore')
    await service.initializeLcoCentral()
    return { data, fetch, service, store, indexedDB }
  }
  it('carga exclusivamente desde API y actualiza revisión tras confirmación', async () => {
    const { data, fetch, service, store, indexedDB } = await setup()
    const { events: _events, ...config } = data
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data, revision: 1 }), { status: 200 }))
    await service.lcoCommands.config(config)
    expect(fetch.mock.calls.at(-1)?.[1].headers['If-Match']).toBe('0')
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data, revision: 2 }), { status: 200 }))
    await service.lcoCommands.config(config)
    expect(fetch.mock.calls.at(-1)?.[1].headers['If-Match']).toBe('1')
    expect(store.getState().lcoStorageStatus).toBe('SAVED')
    expect(indexedDB.open).not.toHaveBeenCalled()
  })
  it('409 conserva snapshot confirmado y muestra error, sin guardar localmente', async () => {
    const { data, fetch, service, store, indexedDB } = await setup()
    const { events: _events, ...config } = data
    const before = store.getState().lcoCouplings
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Actualizá antes de guardar' }), { status: 409 }))
    await expect(service.lcoCommands.config(config)).rejects.toMatchObject({ status: 409 })
    expect(store.getState().lcoCouplings).toBe(before)
    expect(store.getState().lcoStorageError).toContain('Actualizá')
    expect(indexedDB.open).not.toHaveBeenCalled()
  })
  it('espera confirmación para aplicar cambios y rechaza doble guardado', async () => {
    const { data, fetch, service, store } = await setup()
    const { events: _events, ...config } = data
    let resolve!: (response: Response) => void
    fetch.mockImplementationOnce(() => new Promise<Response>((r) => { resolve = r }))
    const before = store.getState().lcoCouplings
    const operation = service.lcoCommands.config({ ...config, inspectionAgeThresholds: { recentDays: 5, dueDays: 10, oldDays: 20 } })
    expect(store.getState().lcoCouplings).toBe(before)
    await expect(service.lcoCommands.config(config)).rejects.toThrow('guardado en curso')
    resolve(new Response(JSON.stringify({ data, revision: 1 }), { status: 200 }))
    await operation
  })
  it('comprueba receipt en servidor antes de informar migración completa', async () => {
    const { data, fetch, service } = await setup()
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data, revision: 1, receipt: { hash: 'abc', eventCount: 0, revision: 1 } }), { status: 200 }))
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ hash: 'abc', eventCount: 0 }), { status: 200 }))
    await service.importLcoCentral(data)
    expect(fetch.mock.calls.at(-1)?.[0]).toContain('/imports/abc')
  })
  it('lee el origen legacy solo por acción explícita y no lo borra al migrar', async () => {
    const { data, fetch, service } = await setup()
    const load = vi.fn().mockResolvedValue(data)
    const clear = vi.fn()
    vi.doMock('../src/maintenance/repositories/IndexedDbLcoCouplingsRepository', () => ({
      IndexedDbLcoCouplingsRepository: class {
        constructor(_name: unknown, readonlyMode: boolean) { expect(readonlyMode).toBe(true) }
        load = load
        clear = clear
      },
    }))
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true))
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ data, revision: 1, receipt: { hash: 'legacy', eventCount: 0 } })))
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ hash: 'legacy', eventCount: 0 })))
    await service.migrateLocalLco()
    expect(load).toHaveBeenCalledOnce()
    expect(clear).not.toHaveBeenCalled()
  })
  it('impide cualquier escritura en el repositorio de migración readonly', async () => {
    const { IndexedDbLcoCouplingsRepository } = await import('../src/maintenance/repositories/IndexedDbLcoCouplingsRepository')
    const source = new IndexedDbLcoCouplingsRepository(undefined, true)
    await expect(source.clear()).rejects.toThrow('solo lectura')
  })
})
