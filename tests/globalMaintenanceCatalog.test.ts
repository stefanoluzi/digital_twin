import { describe, expect, it } from 'vitest'
import {
  GLOBAL_MAINTENANCE_CATALOG,
  getGlobalCatalogSummary,
  getGlobalTaskCampaignStatus,
  getGlobalTaskHistorySummary,
} from '../src/maintenance/data/globalMaintenanceCatalog'

describe('catálogo global REX importado desde Book2.xlsx', () => {
  it('conserva únicamente las 211 tareas válidas y mantiene IDs únicos', () => {
    const { tasks, metadata } = GLOBAL_MAINTENANCE_CATALOG
    expect(tasks).toHaveLength(211)
    expect(new Set(tasks.map((task) => task.id)).size).toBe(211)
    expect(new Set(tasks.map((task) => task.name)).size).toBe(211)
    expect(metadata.excludedRowsWithoutTask).toBe(60)
    expect(metadata.unlinkedPlanIds).toHaveLength(54)
  })

  it('normaliza los totales operativos sin perder los datos fuente ambiguos', () => {
    const summary = getGlobalCatalogSummary()
    expect(summary).toMatchObject({ total: 211, replacements: 67, repairs: 103, highCriticality: 110, withExecution: 184, withPlannedCampaign: 45 })
    expect(summary.totalCostUsd).toBeCloseTo(7_042_039.7)
    expect(GLOBAL_MAINTENANCE_CATALOG.tasks.filter((task) => task.kind === 'REPLACEMENT')).toHaveLength(67)
    expect(GLOBAL_MAINTENANCE_CATALOG.tasks.filter((task) => task.kind === 'REPAIR')).toHaveLength(103)
  })

  it('preserva frecuencias y referencias de costo no numéricas como advertencias', () => {
    const shortFrequency = GLOBAL_MAINTENANCE_CATALOG.tasks.find((task) => task.name === 'Cambio banco cadena de forados')
    const brokenCostReference = GLOBAL_MAINTENANCE_CATALOG.tasks.find((task) => task.name === 'Cambio motores GM-810')
    expect(shortFrequency).toMatchObject({ frequencyYears: null, frequencySource: '<1' })
    expect(shortFrequency?.sourceWarnings).toContain('Frecuencia original: <1')
    expect(brokenCostReference?.costsUsd.mro).toBeNull()
    expect(brokenCostReference?.sourceWarnings).toContain('MRO original: Doc_ELE!A120')
  })

  it('interpreta la matriz de campañas y señala valores desconocidos', () => {
    const motor = GLOBAL_MAINTENANCE_CATALOG.tasks.find((task) => task.name === 'Motor 147 Kw LRE')!
    expect(getGlobalTaskCampaignStatus(motor, 'REX_2023')).toBe('UNKNOWN')
    expect(getGlobalTaskHistorySummary(motor).hasUnknown).toBe(true)
    expect(motor.campaignRaw.REX_2023).toBe('64')
  })

  it('mantiene separadas las tareas transversales sin forzar un sector 3D', () => {
    const transversal = GLOBAL_MAINTENANCE_CATALOG.tasks.filter((task) => task.sectorCode === 'TRANSVERSAL')
    expect(transversal).toHaveLength(2)
    expect(transversal.every((task) => task.areaCode === 'UNASSIGNED')).toBe(true)
  })
})
