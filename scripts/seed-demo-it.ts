/** Explicit, local-only demo data. Run only against a dedicated empty demo database.
 * npx tsx scripts/seed-demo-it.ts --confirm-demo
 * All writes use the same validated API as the UI; no production data is deleted.
 */
import assert from 'node:assert/strict'
import { createDemoSparesData } from '../src/spares/data/demoSpares'
import { createDefaultLcoCouplingTopology } from '../src/maintenance/domain/lcoCouplings'
import { validateSparesData } from '../src/spares/domain/sparesValidation'
import type { PhysicalSpareUnit } from '../src/spares/types'

const base = 'http://127.0.0.1:18080'
assert(process.argv.includes('--confirm-demo'), 'Explicit --confirm-demo required; use a dedicated empty demo DB.')
const day = (offset = 0) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10) }
const month = (offset: number) => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)).toISOString().slice(0, 10) }
async function request(path: string, body?: unknown, revision?: number, method = 'POST') {
  const response = await fetch(base + path, body === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json', 'If-Match': String(revision), 'X-Actor-Id': 'demo-it' }, body: JSON.stringify(body) })
  const result = await response.json()
  assert(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(result)}`)
  return result
}
async function write(prefix: string, path: string, body: unknown, method = 'POST') {
  const state = await request(prefix + '/state')
  return request(prefix + path, body, state.revision, method)
}

const initial = await request('/api/state')
const repairsInitial = await request('/api/repairs/state')
const rexInitial = await request('/api/rex/state')
const lcoInitial = await request('/api/controles-criticos/acoplamientos/state')
const resumeRex = process.argv.includes('--resume-rex')
if (resumeRex) {
  assert(initial.data.spareTypes.length === 39 && repairsInitial.requests.length === 12 && lcoInitial.data.events.length === 9 && rexInitial.tasks.length === 0 && rexInitial.events.length === 3 && rexInitial.events.every((e: any) => e.notes === 'Evento ficticio para presentación IT.'), 'Not the expected incomplete demo; refusing resume.')
} else assert(initial.data.spareTypes.length === 0 && repairsInitial.requests.length === 0 && rexInitial.tasks.length === 0 && rexInitial.events.length === 0 && lcoInitial.data.events.length === 0, 'Demo requires an empty DB. No data was changed.')

const data = createDemoSparesData()
data.config.responsibles = ['Mecánica', 'Hidráulica', 'Servicios', 'Terminación'].map((name, i) => ({ id: `demo-gmb-${i}`, name: `Responsable ${name} · Demo`, active: true }))
data.config.areas.forEach((area, i) => { area.responsibleGmbId = data.config.responsibles[i % 4].id })
for (const [i, area] of data.config.areas.entries()) {
  const equipmentId = `demo-equipment-${i}`
  data.config.equipment.push({ id: equipmentId, area: area.code, name: `Conjunto principal ${area.code}` })
  for (let j = 0; j < 3; j++) {
    const id = `demo-spare-${i}-${j}`
    data.spareTypes.push({ id, sapNumber: `DEMO-${2000 + i * 3 + j}`, name: `${['Rodamiento de apoyo', 'Reductor auxiliar', 'Bomba de lubricación'][j]} · ${area.code}`, description: 'Componente ficticio para demostración de cobertura.', categoryId: ['rodamiento', 'reductor', 'bomba'][j], area: area.code, compatibleEquipmentIds: [equipmentId], drawingNumber: `PL-DEMO-${i + 1}-${j + 1}`, comments: 'Datos simulados; sin información productiva.', createdAt: `${day(-100)}T12:00:00.000Z`, updatedAt: `${day(-2)}T12:00:00.000Z` })
    const status = (['WAREHOUSE', 'MACHINE_SIDE', 'IN_REPAIR', 'ON_ORDER', 'INSTALLED'] as const)[(i * 2 + j) % 5]
    const unit: PhysicalSpareUnit = { id: `PLANTA-DEMO-${2000 + i * 3 + j}`, spareTypeId: id, status, statusSince: day(-15 - i * 3), comment: 'Unidad ficticia para demo IT', location: status === 'WAREHOUSE' ? `Almacén · Estante ${i + 1}` : status === 'MACHINE_SIDE' ? `Reserva junto a equipo ${area.code}` : '', ...(status === 'INSTALLED' ? { installedEquipmentId: equipmentId, installationDate: day(-15 - i * 3) } : {}), ...(status === 'IN_REPAIR' ? { repairStartDate: day(-15 - i * 3), sapNotice: `AV-DEMO-${i}-${j}` } : {}), ...(status === 'ON_ORDER' ? { solp: `SOL-DEMO-${i}-${j}`, purchaseOrder: `OC-DEMO-${i}-${j}`, eta: day(i % 2 ? 20 : -4) } : {}) }
    data.units.push(unit)
    data.history.push({ id: `demo-history-${i}-${j}`, unitId: unit.id, spareTypeId: id, timestamp: `${unit.statusSince}T12:00:00.000Z`, user: 'Operador Demo', nextStatus: status, comment: unit.comment, snapshot: { ...unit } })
  }
}
validateSparesData(data)
if (!resumeRex) await request('/api/import', { format: 'PLANTA_CRITICAL_SPARES', version: 2, exportedAt: new Date().toISOString(), data }, initial.revision)
console.log(`Repuestos: ${data.spareTypes.length}; unidades: ${data.units.length}; áreas: ${data.config.areas.length}`)

// Different recency bands and wear levels, plus a replacement history.
const lco = '/api/controles-criticos/acoplamientos'
const couplings = createDefaultLcoCouplingTopology().couplings
if (!resumeRex) {
for (const [group, days] of [150, 105, 55, 5].entries()) {
  const selected = couplings.slice(group * 8, group * 8 + 8).filter((_, i) => !(group === 0 && i === 0))
  await write(lco, '/events', { type: 'INSPECTION', date: day(-days - 30), inspector: 'Inspector Demo', observations: 'Control anterior simulado.', attachments: [], readings: selected.map((c, i) => ({ couplingId: c.id, wearLevel: Math.max(1, (i % 5)), note: 'Inspección visual simulada.', conditionCode: 'NORMAL' })) })
  await write(lco, '/events', { type: 'INSPECTION', date: day(-days), inspector: 'Inspector Demo', observations: 'Control de desgaste para demostración.', attachments: [], readings: selected.map((c, i) => ({ couplingId: c.id, wearLevel: 1 + (i % 5), note: i % 5 >= 3 ? 'Programar revisión del dentado.' : 'Condición verificada.', conditionCode: i % 5 >= 3 ? 'DESGASTE_DIENTES' : 'NORMAL' })) })
}
await write(lco, '/events', { type: 'COUPLING_REPLACEMENT', date: day(-2), couplingId: couplings[29].id, inspector: 'Inspector Demo', reason: 'Recambio preventivo simulado', sapWorkOrder: 'OT-DEMO-9001', notes: 'Componente nuevo; pendiente control posterior.', wearAtRemoval: 5, attachments: [] })
}
console.log('Acoplamientos: 8 inspecciones y 1 recambio')

const repair = '/api/repairs'
if (!resumeRex) for (let i = 0; i < 12; i++) {
  const equipment = data.config.equipment.find(e => e.id === `demo-equipment-${i % 11}`)!
  if (i < 11) await write(repair, '/equipment', { equipmentId: equipment.id, idrep: `EQ-DEMO-${100 + i}`, name: equipment.name, area: equipment.area, sector: 'Planta', trade: i % 2 ? 'Hidráulica' : 'Mecánica', active: true })
  const target = month(i < 4 ? -1 : i < 8 ? 0 : i - 7)
  const created = await write(repair, '/requests', { equipmentId: equipment.id, quantity: i % 3 === 0 ? 2 : 1, targetMonth: target, requiredDate: target.slice(0, 8) + '20', criticality: i % 4 === 0 ? 'CRITICAL' : i % 3 === 0 ? 'HIGH' : 'NORMAL', criticalReason: i % 4 === 0 || i % 3 === 0 ? 'Reserva operativa necesaria para intervención programada.' : '', fixedDeadline: i % 4 === 0, criticalDueDate: null, responsibleId: data.config.areas.find(a => a.id === equipment.area)!.responsibleGmbId, workshop: 'Taller central', notes: `Necesidad simulada ${i + 1}; datos ficticios para IT.` })
  const row = created.requests.find((r: any) => r.id === created.id)
  const itemIds = row.items.map((item: any) => item.id)
  if (i < 9) {
    await write(repair, `/requests/${created.id}/actions`, { action: 'START', itemIds, date: day(-25), comment: 'Inicio de reparación simulado.' })
    await write(repair, `/requests/${created.id}/actions`, { action: 'COMMIT', itemIds, date: day(i < 4 ? -5 : 12), comment: 'Fecha acordada con taller para la demo.' })
  }
  if (i < 2) await write(repair, `/requests/${created.id}/actions`, { action: 'DELIVER', itemIds, date: day(-8), comment: 'Recepción conforme simulada.' })
  if (i === 3 || i === 6) await write(repair, `/requests/${created.id}/actions`, { action: 'BLOCK', itemIds, date: day(-10), owner: 'PURCHASING', category: 'Repuesto comprado pendiente', description: 'Espera de kit de sellos.', comment: 'Seguimiento de compra ficticia.' })
}
console.log('Taller: 12 necesidades con entregas, bloqueos, compromisos y pendientes')

const rex = '/api/rex'
await write(rex, '/config', { hoursPerDay: '8', hourlyRate: '25', currency: 'USD' }, 'PUT')
const events = []
for (let i = 0; i < 3; i++) {
  if (resumeRex) { events.push(rexInitial.events.find((e: any) => e.name === ['Parada preventiva · Demo', 'Intervención mensual · Demo', 'Parada general próxima · Demo'][i]).id); continue }
  const result = await write(rex, '/events', { name: ['Parada preventiva · Demo', 'Intervención mensual · Demo', 'Parada general próxima · Demo'][i], type: i === 2 ? 'REX' : 'SCHEDULED', startDate: day([-60, -15, 35][i]), endDate: day([-55, -12, 40][i]), status: i === 2 ? 'PLANNED' : 'CLOSED', notes: 'Evento ficticio para presentación IT.' })
  events.push(result.id)
}
for (let i = 0; i < 8; i++) {
  const area = data.config.areas[i]
  const result = await write(rex, '/tasks', { code: `TG-DEMO-${100 + i}`, line: 'Planta', areaId: area.id, equipmentId: `demo-equipment-${i}`, name: `${['Revisión de rodamientos', 'Renovación de sellos', 'Alineación de transmisión', 'Inspección de reductores'][i % 4]} · ${area.code}`, description: 'Tarea preventiva ficticia con alcance y estimación de recursos.', specialty: i % 3 === 0 ? 'MEC/ELE' : 'MEC', criticality: i % 3 === 0 ? 'HIGH' : 'NORMAL', frequencyType: 'PERIODIC', intervalMonths: i % 2 ? 6 : 12, justification: 'Asegurar disponibilidad del equipo.', scope: [{ description: 'Inspeccionar y medir componentes', quantity: 2, unit: 'unidad', required: true, notes: '' }, { description: 'Cambiar sellos y verificar funcionamiento', quantity: 1, unit: 'conjunto', required: true, notes: '' }], estimate: { durationDays: String(1 + i % 3), mechanical: '3', electrical: '1', mro: String(1200 + i * 180), services: '600', ownLabor: '300' } })
  const task = result.tasks.find((t: any) => t.id === result.id)
  await write(rex, '/executions', { taskId: task.id, eventId: events[i < 3 ? 0 : i < 6 ? 1 : 2], responsibleId: area.responsibleGmbId, mode: i >= 6 ? 'PLAN' : 'RESULT', performedAt: i >= 6 ? null : day(i < 3 ? -56 : -13), startedAt: i >= 6 ? null : day(i < 3 ? -60 : -15), ot: `OT-DEMO-${3000 + i}`, notes: 'Intervención simulada.', items: i >= 6 ? [] : task.scope.map((s: any, j: number) => ({ id: s.id, completed: i % 3 === 1 && j === 1 ? 0 : Number(s.quantity), reason: i % 3 === 1 && j === 1 ? 'Falta de repuesto' : '', notes: 'Resultado ficticio.' })) })
}
console.log('REX: 8 tareas, 3 eventos, 8 intervenciones con pendientes y costos')

const verify = await Promise.all(['/api/state', repair + '/state', rex + '/state', lco + '/state'].map(p => request(p)))
assert.equal(verify[0].data.spareTypes.length, 39)
assert.equal(verify[1].requests.length, 12)
assert.equal(verify[2].tasks.length, 8)
assert.equal(verify[3].data.events.length, 9)
assert(!/LC1C|LACO\s*1/i.test(JSON.stringify(verify)), 'Plant identity found in demo API data')
console.log('PASS: nueva lectura de la API confirma datos de los cuatro módulos, sin nombre de planta.')
