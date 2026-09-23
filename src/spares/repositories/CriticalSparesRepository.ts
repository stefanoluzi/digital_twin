import type { CriticalSparesData } from '../types'

/** Legacy snapshot contract. Centralized operations use CentralCriticalSparesRepository. */
export interface CriticalSparesRepository {
  load(): Promise<CriticalSparesData | null>
  replaceAll(data: CriticalSparesData): Promise<void>
  clear(): Promise<void>
}
