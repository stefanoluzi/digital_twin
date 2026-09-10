import {
  indexedDbRequest,
  indexedDbTransactionDone,
  MAINTENANCE_DB_NAME,
  openMaintenanceDatabase,
  PLANNER_STATE_STORE,
} from '../../maintenance/repositories/maintenanceIndexedDb'
import { normalizePlannerData } from '../data/plannerNormalizer'
import type { PlannerModuleData } from '../types'
import type { PlannerRepository } from './PlannerRepository'

const ACTIVE_STATE_KEY = 'active'

export class IndexedDbPlannerRepository implements PlannerRepository {
  constructor(private readonly dbName = MAINTENANCE_DB_NAME) {}

  async load() {
    const db = await openMaintenanceDatabase(this.dbName)
    const transaction = db.transaction(PLANNER_STATE_STORE, 'readonly')
    const done = indexedDbTransactionDone(transaction)
    const stored = await indexedDbRequest<PlannerModuleData | undefined>(transaction.objectStore(PLANNER_STATE_STORE).get(ACTIVE_STATE_KEY))
    await done
    db.close()
    return stored ? normalizePlannerData(stored) : null
  }

  async replaceAll(data: PlannerModuleData) {
    const db = await openMaintenanceDatabase(this.dbName)
    const transaction = db.transaction(PLANNER_STATE_STORE, 'readwrite')
    const done = indexedDbTransactionDone(transaction)
    transaction.objectStore(PLANNER_STATE_STORE).put(normalizePlannerData(data), ACTIVE_STATE_KEY)
    await done
    db.close()
  }

  async clear() {
    const db = await openMaintenanceDatabase(this.dbName)
    const transaction = db.transaction(PLANNER_STATE_STORE, 'readwrite')
    const done = indexedDbTransactionDone(transaction)
    transaction.objectStore(PLANNER_STATE_STORE).delete(ACTIVE_STATE_KEY)
    await done
    db.close()
  }
}
