import { createDefaultPlannerData, normalizePlannerData } from '../data/plannerNormalizer'
import type { PlannerModuleData } from '../types'

export interface PlannerRepository {
  load(): Promise<PlannerModuleData | null>
  replaceAll(data: PlannerModuleData): Promise<void>
  clear(): Promise<void>
}

export class MemoryPlannerRepository implements PlannerRepository {
  private data: PlannerModuleData | null = null

  async load() { return this.data ? structuredClone(this.data) : null }
  async replaceAll(data: PlannerModuleData) { this.data = normalizePlannerData(structuredClone(data)) }
  async clear() { this.data = createDefaultPlannerData() }
}
