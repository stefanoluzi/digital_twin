import { CRITICAL_SPARES_STATE_STORE, indexedDbRequest, indexedDbTransactionDone, MAINTENANCE_DB_NAME, openMaintenanceDatabase } from '../../maintenance/repositories/maintenanceIndexedDb'
import { normalizeCriticalSparesData } from '../data/sparesNormalizer'
import type { CriticalSparesData } from '../types'
import type { CriticalSparesRepository } from './CriticalSparesRepository'

const ACTIVE_STATE_KEY = 'active'

export class IndexedDbCriticalSparesRepository implements CriticalSparesRepository {
  constructor(private readonly dbName = MAINTENANCE_DB_NAME) {}

  async load() {
    const db = await openMaintenanceDatabase(this.dbName)
    const transaction = db.transaction(CRITICAL_SPARES_STATE_STORE, 'readwrite')
    const done = indexedDbTransactionDone(transaction)
    const stored = await indexedDbRequest<CriticalSparesData | undefined>(transaction.objectStore(CRITICAL_SPARES_STATE_STORE).get(ACTIVE_STATE_KEY))
    try {
      const normalized = stored ? normalizeCriticalSparesData(stored) : null
      if (stored && normalized && Number(stored.schemaVersion) < 2) {
        const store = transaction.objectStore(CRITICAL_SPARES_STATE_STORE)
        store.put(stored, 'pre-area-responsibility-v1')
        store.put(normalized, ACTIVE_STATE_KEY)
      }
      await done
      return normalized
    } catch (error) {
      await done.catch(() => undefined)
      throw error
    } finally { db.close() }
  }

  async replaceAll(data: CriticalSparesData) {
    const db = await openMaintenanceDatabase(this.dbName)
    const transaction = db.transaction(CRITICAL_SPARES_STATE_STORE, 'readwrite')
    const done = indexedDbTransactionDone(transaction)
    transaction.objectStore(CRITICAL_SPARES_STATE_STORE).put(normalizeCriticalSparesData(data), ACTIVE_STATE_KEY)
    await done
    db.close()
  }

  async clear() {
    const db = await openMaintenanceDatabase(this.dbName)
    const transaction = db.transaction(CRITICAL_SPARES_STATE_STORE, 'readwrite')
    const done = indexedDbTransactionDone(transaction)
    transaction.objectStore(CRITICAL_SPARES_STATE_STORE).delete(ACTIVE_STATE_KEY)
    await done
    db.close()
  }
}
