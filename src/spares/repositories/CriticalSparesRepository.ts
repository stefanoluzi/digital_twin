import type { CriticalSparesData } from '../types'

export interface CriticalSparesRepository {
  load(): Promise<CriticalSparesData | null>
  replaceAll(data: CriticalSparesData): Promise<void>
  clear(): Promise<void>
}
