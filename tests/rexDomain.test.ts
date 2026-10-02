import { describe, expect, it } from 'vitest'
import { addMonths, deriveStatus, taskMetrics, compareTaskDueRows } from '../src/rex/domain'
import type { RexExecution, RexState, RexTask } from '../src/rex/types'
import { taskSchema, eventSchema, executionSchema } from '../server/rex/validation'
const task = { id: 'task', active: true, frequencyType: 'PERIODIC', intervalMonths: 24 } as RexTask
const base = { tasks: [task], executions: [], pending: [], events: [] } as unknown as RexState
const execution = (patch: Partial<RexExecution>) => ({ id: 'e', taskId: 'task', intent: 'FULL_TASK', status: 'COMPLETED', performedAt: '2024-05-18', createdAt: '2024-05-18', items: [{ quantity: 1, completed: 1, required: true }], ...patch }) as RexExecution
describe('Dominio REX', () => {
  it('prioriza vencidas por antigüedad, luego fechas próximas y finalmente sin fecha', () => {
    const specs = [
      ['sin-fecha', 'A sin historial', null], ['futura', 'A futura', '2027-01-01'],
      ['proxima', 'Z próxima', '2026-10-02'], ['vencida', 'A vencida', '2026-09-01'],
      ['antigua', 'Z vencida con pendiente', '2026-07-01'], ['hoy', 'Hoy', '2026-10-01'],
    ]
    const tasks = specs.map(([id, name]) => ({ ...task, id: id!, name: name!, intervalMonths: 12 }))
    const state = { ...base, tasks, executions: specs.filter(([, , due]) => due).map(([id, , due]) => execution({ id: id!, taskId: id!, performedAt: addMonths(due!, -12) })), pending: [{ taskId: 'antigua', remaining: '1' }] } as RexState
    const rows = tasks.map(t => ({ task: t, metrics: taskMetrics(t, state, '2026-10-01') }))
    expect(rows.find(r => r.task.id === 'antigua')!.metrics.status).toBe('PARTIAL_PENDING')
    expect(rows.sort(compareTaskDueRows).map(r => r.task.id)).toEqual(['antigua', 'vencida', 'hoy', 'proxima', 'futura', 'sin-fecha'])
  })
  it('sin historial no inventa un ciclo', () => { expect(taskMetrics(task, base).cycle).toBe('NO_HISTORY'); expect(taskMetrics(task, base).due).toBeNull() })
  it('suma meses calendario respetando fin de mes y bisiestos', () => { expect(addMonths('2024-01-31', 1)).toBe('2024-02-29'); expect(addMonths('2024-02-29', 12)).toBe('2025-02-28'); expect(addMonths('2024-05-18', 24)).toBe('2026-05-18') })
  it('calcula vencida y próxima 90 días sin timezone drift', () => {
    const state = { ...base, executions: [execution({})] }
    expect(taskMetrics(task, state, '2026-05-19').cycle).toBe('OVERDUE')
    expect(taskMetrics(task, state, '2026-05-18').cycle).toBe('UPCOMING')
    expect(taskMetrics(task, state, '2025-01-01').cycle).toBe('CURRENT')
  })
  it('3/4 es parcial; ninguno no realizada; todos completa', () => {
    const items = [1, 1, 1, 0].map((completed) => ({ quantity: 1, completed, required: true }))
    expect(deriveStatus(items)).toBe('PARTIAL'); expect(deriveStatus(items.map((i) => ({ ...i, completed: 0 })))).toBe('NOT_PERFORMED'); expect(deriveStatus(items.map((i) => ({ ...i, completed: 1 })))).toBe('COMPLETED')
  })
  it('ni parcial ni resolución reinician frecuencia', () => {
    const state = { ...base, executions: [execution({}), execution({ id: 'p', status: 'PARTIAL', performedAt: '2026-05-18' }), execution({ id: 'r', intent: 'PENDING_RESOLUTION', performedAt: '2026-08-18' })] }
    expect(taskMetrics(task, state, '2026-09-28').due).toBe('2026-05-18')
    expect(taskMetrics(task, state).lastComplete?.id).toBe('e')
    expect(taskMetrics(task, state).lastIntervention?.id).toBe('r')
  })
  it('fecha histórica desconocida no inventa próxima fecha', () => {
    const m = taskMetrics(task, { ...base, executions: [execution({}), execution({ id: 'unknown', performedAt: null })] })
    expect(m.cycle).toBe('UNCERTAIN'); expect(m.due).toBeNull()
  })
  it('frecuencia no temporal no calcula una fecha', () => { const m = taskMetrics({ ...task, frequencyType: 'COUNTER_BASED' }, { ...base, executions: [execution({})] }); expect(m.due).toBeNull(); expect(m.cycle).toBe('NO_FREQUENCY') })
  it('valida meses y rechaza estados manuales completos', () => {
    expect(taskSchema.safeParse({ name: 'X', areaId: 'LCO', specialty: 'MEC', criticality: 'NORMAL', frequencyType: 'PERIODIC', scope: [] }).success).toBe(false)
    expect(executionSchema.safeParse({ taskId: 't', mode: 'RESULT', items: [], status: 'COMPLETED' }).success).toBe(false)
  })
  it('evento sin fechas es válido y fechas imposibles no', () => {
    expect(eventSchema.safeParse({ name: 'REX 2021', type: 'REX', status: 'CLOSED' }).success).toBe(true)
    expect(eventSchema.safeParse({ name: 'REX', type: 'REX', status: 'CLOSED', startDate: '2026-02-30' }).success).toBe(false)
  })
})
