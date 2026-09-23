import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDemoSparesData } from '../src/spares/data/demoSpares'

describe('Frontend de persistencia central', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })
  const setup = async () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() })
    const indexedDB = { open: vi.fn(() => { throw new Error('No acceder a IndexedDB') }) }
    vi.stubGlobal('indexedDB', indexedDB)
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: createDemoSparesData(), revision: 7 }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const service = await import('../src/spares/services/criticalSparesPersistenceService')
    const { useCriticalSparesStore: store } = await import('../src/spares/store/criticalSparesStore')
    await service.initializeCriticalSparesPersistence()
    return { service, store, fetch, indexedDB }
  }
  it('carga por API sin leer ni escribir datos operativos en IndexedDB', async () => {
    const { store, fetch, indexedDB } = await setup()
    expect(fetch.mock.calls[0][0]).toBe('/api/state')
    expect(store.getState().storageStatus).toBe('SAVED')
    expect(indexedDB.open).not.toHaveBeenCalled()
  })
  it('un conflicto no modifica el estado confirmado ni guarda localmente', async () => {
    const { service, store, fetch, indexedDB } = await setup()
    const before = store.getState().spareTypes
    fetch.mockResolvedValue(new Response(JSON.stringify({ error: 'Datos obsoletos' }), { status: 409 }))
    await expect(service.sparesActions.deleteSpare(before[0].id)).rejects.toMatchObject({ status: 409 })
    expect(store.getState().spareTypes).toBe(before)
    expect(store.getState().storageError).toContain('obsoletos')
    expect(fetch.mock.calls[1][1].headers['If-Match']).toBe('7')
    expect(indexedDB.open).not.toHaveBeenCalled()
  })
  it('un fallo de importación no hidrata ni borra el snapshot anterior', async () => {
    const { service, store, fetch } = await setup()
    const before = store.getState().spareTypes
    fetch.mockRejectedValue(new Error('offline'))
    const incoming = createDemoSparesData(); incoming.spareTypes = []
    await expect(service.replaceCriticalSparesData(incoming)).rejects.toThrow('No hay conexión')
    expect(store.getState().spareTypes).toBe(before)
  })
})
