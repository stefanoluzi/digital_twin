import { describe, expect, it } from 'vitest'
import { meetingSelection, matchesMeetingFilter, matchesStateFilters, toggleFilter, toggleMeetingFilter, repairSearchText, type StateFilter } from '../src/repairs/meetingFilters'
import { RepairPlanLegend } from '../src/repairs/RepairPlanLegend'
import type { RepairRequest } from '../src/repairs/types'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ExercisePlan } from '../src/repairs/ExercisePlan'
import { PlanFilterBar } from '../src/repairs/PlanFilterBar'

function request(id: string, month: string, date: string | null = null, criticality: RepairRequest['criticality'] = 'NORMAL'): RepairRequest {
  return { id, equipmentId: id, targetMonth: `${month}-01`, requiredDate: date, criticality, quantity: 2, criticalReason: 'Falta rodamiento', fixedDeadline: false, criticalDueDate: null, responsibleId: 'gmb', workshop: 'Central', notes: 'Revisar lubricación', createdAt: '', updatedAt: '', createdBy: '', responsible: null, equipment: { id, name: 'Reductor', area: 'HG', repairProfile: { equipmentId: id, idrep: 'EQ1', sector: '', trade: 'Mecánica', active: true } }, items: [1, 2].map((ordinal) => ({ id: `${id}-${ordinal}`, ordinal, status: 'PENDING', startedAt: null, sentAt: null, commitments: [], blocks: [], delivery: null })) }
}
describe('Filtros de reunión del plan', () => {
  it('clic exclusivo, Ctrl/Cmd toggle y reemplazo después de multiselección', () => {
    let selected: StateFilter[] = toggleFilter([], 'BLOCKED')
    selected = toggleFilter(selected, 'IN_PROGRESS', { ctrlKey: true })
    expect(selected).toEqual(['BLOCKED', 'IN_PROGRESS'])
    selected = toggleFilter(selected, 'PENDING', { metaKey: true })
    expect(selected).toEqual(['BLOCKED', 'IN_PROGRESS', 'PENDING'])
    selected = toggleFilter(selected, 'BLOCKED', { ctrlKey: true })
    expect(selected).toEqual(['IN_PROGRESS', 'PENDING'])
    expect(toggleFilter(selected, 'DELIVERED')).toEqual(['DELIVERED'])
    expect(toggleFilter(['PENDING'], 'PENDING', { metaKey: true })).toEqual([])
    const html = renderToStaticMarkup(createElement(RepairPlanLegend, { selected }))
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2)
  })
  it('Todas es selección vacía y no coexiste con otros filtros', () => {
    let selected = toggleMeetingFilter([], 'OVERDUE', { ctrlKey: true })
    selected = toggleMeetingFilter(selected, 'MONTH', { metaKey: true })
    expect(selected).toEqual(['OVERDUE', 'MONTH'])
    expect(toggleMeetingFilter(selected, 'ALL')).toEqual([])
    expect(toggleMeetingFilter(selected, 'CRITICAL')).toEqual(['CRITICAL'])
    selected = toggleMeetingFilter(selected, 'MONTH', { ctrlKey: true })
    expect(toggleMeetingFilter(selected, 'OVERDUE', { ctrlKey: true })).toEqual([])
  })
  it('unión sin duplicados y AND con estado, área y búsqueda, conserva selección entre ejercicios', () => {
    const overdue = request('old', '2026-09')
    overdue.items[0].status = 'BLOCKED'
    const both = request('both', '2026-10', '2026-10-01')
    both.items[0].status = 'IN_PROGRESS'
    const otherArea = request('area', '2026-10'); otherArea.equipment.area = 'LCO'
    const otherState = request('state', '2026-10')
    const nextYear = request('future', '2027-10'); nextYear.items[0].status = 'BLOCKED'
    const rows = [overdue, both, both, otherArea, otherState, nextYear]
    const selected: StateFilter[] = ['BLOCKED', 'IN_PROGRESS']
    const filtered = rows.filter((r) => matchesStateFilters(r, selected, '2026-10-02') && r.equipment.area === 'HG' && repairSearchText(r).includes('reductor'))
    const result = meetingSelection(filtered, 2026, '2026-10-02', ['OVERDUE', 'MONTH'])
    expect(result.visible.map((r) => r.id)).toEqual(['old', 'both'])
    expect(result.counts.ALL).toBe(2)
    expect(meetingSelection(filtered, 2027, '2027-10-02', ['OVERDUE', 'MONTH']).visible.map((r) => r.id)).toEqual(['future'])
    expect(selected).toEqual(['BLOCKED', 'IN_PROGRESS'])
    expect(meetingSelection(filtered, 2026, '2026-10-02', []).visible.map((r) => r.id)).toEqual(['old', 'both'])
  })
  it('ubica filtros debajo de la leyenda y antes de la matriz, conserva encabezados y creación', () => {
    const r = request('r', '2026-10')
    const html = renderToStaticMarkup(createElement(ExercisePlan, { state: { revision: 1, requests: [r], equipment: [r.equipment], areas: [], responsibles: [], users: [], config: { warningDays: 7, workshops: [], blockCategories: [] } }, requests: [r], equipment: [r.equipment], filters: createElement('input', { placeholder: 'Filtro de prueba' }), year: 2026, today: '2026-10-01', busy: false, onYear: () => {}, onSave: async () => true, onDetail: () => {}, onDetailedNew: () => {}, onAction: () => {}, onConfigure: () => {} }))
    expect(html.indexOf('repair-plan-legend')).toBeLessThan(html.indexOf('Filtro de prueba'))
    expect(html.indexOf('Filtro de prueba')).toBeLessThan(html.indexOf('table-scroll exercise-grid'))
    expect(html).toContain('1 necesidades')
    expect(html).toContain('Plan del ejercicio · 2026/27')
    expect(html).not.toContain('Plan de reparaciones')
    expect(html.indexOf('role="status"')).toBeLessThan(html.indexOf('exercise-kpis'))
    expect(html).toContain('Ejercicio anterior')
    expect(html).toContain('Ejercicio siguiente')
    expect(html).not.toContain('Próximo mes')
    expect(html).toContain('NECESIDADES DEL EJERCICIO</span><strong>1</strong>')
    expect(html).toContain('UNIDADES ENTREGADAS')
    expect(html).toContain('CUMPLIMIENTO A FECHA')
    expect(html).not.toContain('unidades exigibles entregadas a hoy')
    expect(html).not.toContain('Las necesidades futuras')
    expect(html).toContain('HOY')
    expect(html).toContain('Agregar')
  })
  it('Más filtros comienza cerrado, conserva controles y cuenta secundarios incluido próximo mes', () => {
    const html = renderToStaticMarkup(createElement(PlanFilterBar, { search: createElement('input'), area: createElement('select'), secondary: createElement('select', { value: 'Central', onChange: () => {} }, createElement('option', { value: 'Central' }, 'Central')), activeCount: 2, nextMonth: true, onNextMonth: () => {}, onClear: () => {} }))
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('Más filtros (3)')
    expect(html).toContain('class="plan-filter-secondary" hidden=""')
    expect(html).toContain('selected=""')
    expect(html).toContain('checked=""')
    expect(html).toContain('Limpiar')
  })
  it('integra nueva necesidad con el selector y mantiene seis indicadores y doce meses', () => {
    const r = request('compact', '2026-10')
    const html = renderToStaticMarkup(createElement(ExercisePlan, {
      state: { revision: 1, requests: [r], equipment: [r.equipment], areas: [], responsibles: [], users: [], config: { warningDays: 7, workshops: [], blockCategories: [] } },
      requests: [r], equipment: [r.equipment], year: 2026, today: '2026-10-02', busy: true,
      onYear: () => {}, onNew: () => {}, onSave: async () => true, onDetail: () => {}, onDetailedNew: () => {}, onAction: () => {}, onConfigure: () => {},
    }))
    expect(html).toContain('class="primary" disabled="">+ Nueva necesidad')
    expect(html.indexOf('+ Nueva necesidad')).toBeLessThan(html.indexOf('exercise-kpis'))
    expect(html.match(/class="coverage-kpi"/g)).toHaveLength(6)
    expect(html.match(/data-cell="0:/g)).toHaveLength(12)
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('repair-mixed')
  })
  it('cuenta necesidades, no unidades, para los indicadores compartidos', () => {
    const r = request('r', '2026-09', null, 'CRITICAL')
    const counts = meetingSelection([r], 2026, '2026-10-02', 'ALL').counts
    expect(r.items).toHaveLength(2)
    expect(counts).toMatchObject({ ALL: 1, OVERDUE: 1, CRITICAL: 1 })
  })
  it('usa el mes calendario, el día actual y cierre de mes sin día exacto', () => {
    const r = request('r', '2026-10')
    expect(matchesMeetingFilter(r, 'MONTH', '2026-10-01')).toBe(true)
    expect(matchesMeetingFilter(r, 'OVERDUE', '2026-10-31')).toBe(false)
    expect(matchesMeetingFilter(r, 'OVERDUE', '2026-11-01')).toBe(true)
    r.requiredDate = '2026-10-01'
    expect(matchesMeetingFilter(r, 'OVERDUE', '2026-10-01')).toBe(false)
    expect(matchesMeetingFilter(r, 'OVERDUE', '2026-10-02')).toBe(true)
  })
  it('diciembre → enero y cambio de ejercicio conservan cantidades reales', () => {
    const rows = [request('d', '2026-12'), request('j', '2027-01'), request('next', '2027-07')]
    const selection = meetingSelection(rows, 2026, '2026-12-15', 'NEXT')
    expect(selection.visible.map((r) => r.id)).toEqual(['j'])
    expect(selection.counts).toMatchObject({ ALL: 2, MONTH: 1, NEXT: 1 })
    expect(meetingSelection(rows, 2027, '2026-12-15', 'ALL').visible.map((r) => r.id)).toEqual(['next'])
    expect(meetingSelection(rows, 2026, '2027-01-01', 'MONTH').visible.map((r) => r.id)).toEqual(['j'])
  })
  it('excluye entregadas/canceladas; conserva las entregas parciales y críticas abiertas', () => {
    const r = request('r', '2026-09', null, 'CRITICAL')
    r.items[0].status = 'DELIVERED'
    expect(matchesMeetingFilter(r, 'OVERDUE', '2026-10-01')).toBe(true)
    expect(matchesMeetingFilter(r, 'CRITICAL', '2026-10-01')).toBe(true)
    r.items[1].status = 'DELIVERED'
    expect(matchesMeetingFilter(r, 'OVERDUE', '2026-10-01')).toBe(false)
    expect(matchesMeetingFilter(r, 'CRITICAL', '2026-10-01')).toBe(false)
    r.items[1].status = 'CANCELLED'
    expect(matchesMeetingFilter(r, 'OVERDUE', '2026-10-01')).toBe(false)
  })
  it('ordena criticidad y fecha; conserva orden Todas y combina filtros avanzados', () => {
    const rows = [request('normal', '2026-08'), request('new', '2026-09', '2026-09-20', 'CRITICAL'), request('old', '2026-09', '2026-09-01', 'CRITICAL')]
    expect(meetingSelection(rows, 2026, '2026-10-01', 'OVERDUE').visible.map((r) => r.id)).toEqual(['old', 'new', 'normal'])
    expect(meetingSelection(rows, 2026, '2026-09-01', 'MONTH').visible.map((r) => r.id)).toEqual(['old', 'new'])
    expect(meetingSelection(rows, 2026, '2026-10-01', 'ALL').visible).toEqual(rows)
    rows[1].equipment.area = 'LCO'
    const filtered = rows.filter((r) => r.equipment.area === 'HG' && r.workshop === 'Central' && r.responsibleId === 'gmb')
    expect(meetingSelection(filtered, 2026, '2026-10-01', 'OVERDUE').counts.OVERDUE).toBe(2)
  })
  it('busca IDREP, equipo, notas y motivo; usa febrero bisiesto', () => {
    const r = request('r', '2028-02')
    for (const term of ['eq1', 'reductor', 'lubricación', 'rodamiento']) expect(repairSearchText(r)).toContain(term)
    expect(matchesMeetingFilter(r, 'OVERDUE', '2028-02-29')).toBe(false)
    expect(matchesMeetingFilter(r, 'OVERDUE', '2028-03-01')).toBe(true)
  })
})
