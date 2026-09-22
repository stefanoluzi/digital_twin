import type { CriticalSparesData, PhysicalSpareUnit, SpareType, SpareUnitStatus } from '../types'
import { spareResponsibleId } from './areaResponsibility'

export const AVAILABLE_STATUSES: SpareUnitStatus[] = ['WAREHOUSE', 'MACHINE_SIDE']
export const STATUS_LABELS: Record<SpareUnitStatus, string> = {
  WAREHOUSE: 'Almacén', MACHINE_SIDE: 'Pie de máquina', INSTALLED: 'Instalado', IN_REPAIR: 'En reparación', ON_ORDER: 'En compra',
}

export function daysSince(date: string, now = new Date()) {
  const start = new Date(`${date.slice(0, 10)}T00:00:00`)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Number.isFinite(start.getTime()) ? Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000)) : 0
}

export function unitsForSpare(data: CriticalSparesData, spareId: string) {
  return data.units.filter((unit) => unit.spareTypeId === spareId)
}

export function hasOverduePurchase(data: CriticalSparesData, spareId: string, now = new Date()) {
  return unitsForSpare(data, spareId).some((unit) => unit.status === 'ON_ORDER' && Boolean(unit.eta) && new Date(`${unit.eta}T23:59:59`) < now)
}

export function spareCoverage(data: CriticalSparesData, spareId: string, now = new Date()) {
  const units = unitsForSpare(data, spareId)
  const available = units.filter((unit) => AVAILABLE_STATUSES.includes(unit.status))
  const byStatus = (status: SpareUnitStatus) => units.filter((unit) => unit.status === status)
  const uncoveredAt = available.length ? null : getUncoveredAt(data, spareId)
  const uncoveredSince = uncoveredAt ? daysSince(uncoveredAt, now) : 0
  return { covered: available.length > 0, available: available.length, total: units.length, repair: byStatus('IN_REPAIR').length, purchase: byStatus('ON_ORDER').length, installed: byStatus('INSTALLED').length, uncoveredSince, uncoveredAt }
}

/** Reconstruye el último quiebre conocido para respaldos anteriores a esta versión. */
export function getUncoveredAt(data: CriticalSparesData, spareId: string): string | null {
  const spare = data.spareTypes.find((item) => item.id === spareId)
  const units = unitsForSpare(data, spareId)
  if (!spare || units.some((unit) => AVAILABLE_STATUSES.includes(unit.status))) return null
  if (spare.uncoveredAt) return spare.uncoveredAt
  const states = new Map(units.map((unit) => [unit.id, unit.status]))
  const events = data.history.filter((event) => event.spareTypeId === spareId && states.has(event.unitId))
    .sort((a, b) => (b.snapshot.statusSince || b.timestamp).localeCompare(a.snapshot.statusSince || a.timestamp))
  for (const event of events) {
    if (event.previousStatus) states.set(event.unitId, event.previousStatus)
    else states.delete(event.unitId)
    if ([...states.values()].some((status) => AVAILABLE_STATUSES.includes(status))) return event.snapshot.statusSince || event.timestamp
  }
  // Sin evidencia de cobertura anterior, solo conocemos el inicio de seguimiento del tipo.
  return spare.createdAt
}

export function selectSpares(data: CriticalSparesData, items: SpareType[]): CriticalSparesData {
  const ids = new Set(items.map((item) => item.id))
  return { ...data, spareTypes: items, units: data.units.filter((unit) => ids.has(unit.spareTypeId)), history: data.history.filter((event) => ids.has(event.spareTypeId)) }
}

export function groupedCoverage(data: CriticalSparesData, groups: { id: string; name: string }[], dimension: 'area' | 'gmb') {
  return groups.map((group) => ({ ...group, ...coverageSummary(selectSpares(data, data.spareTypes.filter((spare) => (dimension === 'area' ? spare.area : spareResponsibleId(data, spare) || 'UNASSIGNED') === group.id))) }))
}

export function recoveryDetails(units: PhysicalSpareUnit[]) {
  return units.filter((unit) => unit.status === 'IN_REPAIR' || unit.status === 'ON_ORDER').map((unit) => {
    if (unit.status === 'IN_REPAIR') return unit.sapNotice ? `Aviso SAP ${unit.sapNotice}` : 'Reparación sin aviso informado'
    return [unit.solp ? `SOLP ${unit.solp}` : 'Compra sin SOLP informada', unit.purchaseOrder && `OC ${unit.purchaseOrder}`, unit.eta && `ETA ${formatDate(unit.eta)}`].filter(Boolean).join(' · ')
  }).join(' / ') || 'Sin acción registrada'
}

export function trackingSituations(data: CriticalSparesData, state = 'ALL', now = new Date()) {
  return data.spareTypes.flatMap((spare) => unitsForSpare(data, spare.id)
    .filter((unit) => (unit.status === 'IN_REPAIR' || unit.status === 'ON_ORDER') && (state === 'ALL' || unit.status === state))
    .map((unit) => ({ spare, unit, days: daysSince(unit.statusSince, now), coverage: spareCoverage(data, spare.id, now) })))
    .sort((a, b) => Number(a.coverage.covered) - Number(b.coverage.covered) || (!a.coverage.covered ? b.coverage.uncoveredSince - a.coverage.uncoveredSince : 0) || b.days - a.days)
}

export function coverageSummary(data: CriticalSparesData, now = new Date()) {
  const coverages = data.spareTypes.map((spare) => spareCoverage(data, spare.id, now))
  const covered = coverages.filter((item) => item.covered).length
  return {
    total: coverages.length,
    covered,
    uncovered: coverages.length - covered,
    repair: data.units.filter((unit) => unit.status === 'IN_REPAIR').length,
    purchase: data.units.filter((unit) => unit.status === 'ON_ORDER').length,
    percent: coverages.length ? Math.round(covered / coverages.length * 100) : 0,
  }
}

/** Repuestos descubiertos que tienen al menos una unidad en cada estado real. */
export function uncoveredStatusCounts(data: CriticalSparesData, now = new Date()) {
  const uncovered = data.spareTypes.map((spare) => spareCoverage(data, spare.id, now)).filter((coverage) => !coverage.covered)
  return {
    repair: uncovered.filter((coverage) => coverage.repair > 0).length,
    purchase: uncovered.filter((coverage) => coverage.purchase > 0).length,
  }
}

export function getRecoveryAction(units: PhysicalSpareUnit[], now = new Date()) {
  const repair = units.filter((unit) => unit.status === 'IN_REPAIR').sort((a, b) => daysSince(b.statusSince, now) - daysSince(a.statusSince, now))[0]
  if (repair) return { kind: 'repair', text: `En reparación hace ${daysSince(repair.statusSince, now)} días${repair.sapNotice ? ` · Aviso ${repair.sapNotice}` : ''}` }
  const order = units.filter((unit) => unit.status === 'ON_ORDER').sort((a, b) => daysSince(b.statusSince, now) - daysSince(a.statusSince, now))[0]
  if (order) return { kind: 'purchase', text: `En compra hace ${daysSince(order.statusSince, now)} días${order.solp ? ` · SOLP ${order.solp}` : ''}${order.eta ? ` · ETA ${formatDate(order.eta)}` : ''}` }
  return { kind: 'none', text: 'Sin acción registrada' }
}

export function getSpareAlerts(data: CriticalSparesData, spare: SpareType, now = new Date()) {
  const units = unitsForSpare(data, spare.id)
  const coverage = spareCoverage(data, spare.id, now)
  const alerts: { level: 'critical' | 'warning'; text: string }[] = []
  if (!coverage.covered) alerts.push({ level: 'critical', text: 'Repuesto sin cobertura' })
  if (!coverage.covered && !units.some((unit) => unit.status === 'IN_REPAIR' || unit.status === 'ON_ORDER')) alerts.push({ level: 'critical', text: 'Sin acción de recuperación' })
  if (units.some((unit) => unit.status === 'IN_REPAIR' && daysSince(unit.statusSince, now) > 60)) alerts.push({ level: 'warning', text: 'Reparación abierta hace más de 60 días' })
  if (hasOverduePurchase(data, spare.id, now)) alerts.push({ level: 'critical', text: 'Compra con ETA vencida' })
  return alerts
}

export function formatDate(value?: string) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}
