import type { Vector3Data } from '../types/plant'

type InsertionPointProvider = () => Vector3Data

let activeProvider: InsertionPointProvider | null = null

export function registerInsertionPointProvider(provider: InsertionPointProvider) {
  activeProvider = provider

  return () => {
    if (activeProvider === provider) activeProvider = null
  }
}

export function getCurrentInsertionPoint(elevation?: number): Vector3Data {
  const point = activeProvider?.() ?? { x: 0, y: 0, z: 0 }
  return typeof elevation === 'number' && Number.isFinite(elevation) ? { ...point, y: elevation } : point
}
