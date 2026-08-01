import type { Vector3Data } from '../types/plant'

export interface ObjectWorldBounds {
  min: Vector3Data
  max: Vector3Data
}

type ObjectBoundsProvider = (id: string) => ObjectWorldBounds | null

let activeProvider: ObjectBoundsProvider | null = null

export function registerObjectBoundsProvider(provider: ObjectBoundsProvider) {
  activeProvider = provider
  return () => {
    if (activeProvider === provider) activeProvider = null
  }
}

export function getObjectWorldBounds(id: string) {
  return activeProvider?.(id) ?? null
}
