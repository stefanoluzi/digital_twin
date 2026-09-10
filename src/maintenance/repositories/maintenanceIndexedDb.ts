export const MAINTENANCE_DB_NAME = 'LACO1_MAINTENANCE'
export const MAINTENANCE_DB_VERSION = 2

export const LCO_EVENTS_STORE = 'lcoEvents'
export const LCO_ATTACHMENTS_STORE = 'lcoAttachments'
export const LCO_CONFIG_STORE = 'lcoConfig'
export const PLANNER_STATE_STORE = 'plannerState'

export function openMaintenanceDatabase(dbName = MAINTENANCE_DB_NAME) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const openRequest = indexedDB.open(dbName, MAINTENANCE_DB_VERSION)
    openRequest.onupgradeneeded = () => {
      const db = openRequest.result
      if (!db.objectStoreNames.contains(LCO_EVENTS_STORE)) db.createObjectStore(LCO_EVENTS_STORE, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(LCO_ATTACHMENTS_STORE)) {
        const store = db.createObjectStore(LCO_ATTACHMENTS_STORE, { keyPath: 'id' })
        store.createIndex('eventId', 'eventId', { unique: false })
      }
      if (!db.objectStoreNames.contains(LCO_CONFIG_STORE)) db.createObjectStore(LCO_CONFIG_STORE)
      if (!db.objectStoreNames.contains(PLANNER_STATE_STORE)) db.createObjectStore(PLANNER_STATE_STORE)
    }
    openRequest.onsuccess = () => {
      const db = openRequest.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    openRequest.onerror = () => reject(openRequest.error ?? new Error('No se pudo abrir la base local de Maintenance.'))
    openRequest.onblocked = () => reject(new Error('La base local está abierta en otra pestaña desactualizada. Cerrala y volvé a intentar.'))
  })
}

export function indexedDbRequest<T>(value: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    value.onsuccess = () => resolve(value.result)
    value.onerror = () => reject(value.error)
  })
}

export function indexedDbTransactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new Error('Transacción IndexedDB cancelada.'))
  })
}
