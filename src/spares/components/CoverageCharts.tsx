import { useState } from 'react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CriticalSparesData } from '../types'
import { coverageByArea, coverageByGmb, coverageCauses, type CoverageCause } from '../domain/dashboardSelectors'
import { responsibleAreas } from '../domain/areaResponsibility'
import './coverageCharts.css'

type CoverageRow = ReturnType<typeof coverageByArea>[number]
function CoverageBar({ row }: { row: Pick<CoverageRow, 'total' | 'covered' | 'percent'> }) {
  const color = !row.total ? 'var(--sp-soft)' : row.covered === row.total ? 'var(--sp-green)' : row.covered === 0 ? 'var(--sp-red)' : 'var(--sp-yellow)'
  return <span className={`executive-bar ${!row.total ? 'empty-track' : row.covered === 0 ? 'risk-track' : ''}`} aria-hidden="true">
    <ResponsiveContainer width="100%" height={16}>
      <BarChart layout="vertical" data={[row]} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
        <XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" hide />
        <Bar dataKey="percent" fill={color} barSize={12}  isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  </span>
}

function coverageText(row: Pick<CoverageRow, 'total' | 'covered' | 'percent' | 'uncovered' | 'repair' | 'purchase'>) {
  return row.total ? `Cobertura: ${row.percent}% · ${row.covered} de ${row.total} tipos cubiertos\n${row.uncovered} tipos sin cobertura\n${row.repair} unidades en reparación · ${row.purchase} unidades en compra` : 'Sin datos · Sin repuestos registrados'
}

export function CoverageByAreaChart({ data, selected, responsible, onSelect }: { data: CriticalSparesData; selected: string; responsible: string; onSelect: (id: string) => void }) {
  const [order, setOrder] = useState<'operational' | 'worst'>('worst')
  const assigned = responsibleAreas(data, responsible).map((area) => area.code as string)
  const rows = coverageByArea(data, order).filter((row) => responsible === 'ALL' || assigned.includes(row.id))
  return <section className="spares-panel area-chart"><header><div><small>01 · DÓNDE ESTÁ EL PROBLEMA</small><h2>Cobertura por Área</h2></div><select aria-label="Orden de áreas" value={order} onChange={(event) => setOrder(event.target.value as typeof order)}><option value="worst">Peor cobertura</option><option value="operational">Orden operacional</option></select></header>
    <div className="executive-bars">{rows.map((row) => <div className={`executive-row ${!row.total ? 'no-data' : ''} ${selected === row.id ? 'selected' : selected !== 'ALL' ? 'muted-selection' : ''}`} key={row.id}>
      <button className="bar-main" aria-pressed={selected === row.id} title={`${row.id} · ${row.name}\n${coverageText(row)}\nResponsable: ${row.responsible}\nClick para filtrar el Dashboard. Segundo click para quitar el filtro.`} onClick={() => onSelect(row.id)} aria-label={`${row.id}: ${coverageText(row)}. Filtrar Dashboard`}>
        <strong className="bar-label">{row.id}</strong><CoverageBar row={row} /><b className="bar-percent">{row.total ? `${row.percent}%` : '—'}</b><span className="bar-ratio">{row.total ? `${row.covered} / ${row.total}` : 'Sin datos'}</span>
      </button><button className={`bar-uncovered ${row.uncovered ? '' : 'no-risk'}`} aria-pressed={selected === row.id} onClick={() => onSelect(row.id)} aria-label={`${row.id}: ${row.uncovered} sin cobertura`}>{row.total ? `${row.uncovered} sin cobertura` : '—'}</button>
    </div>)}{!rows.length && <p className="chart-footnote">Sin áreas asignadas al responsable seleccionado.</p>}</div><p className="chart-footnote">Tipos cubiertos / total · Click para filtrar. Segundo click para quitar. Comparativa sin filtro de área.</p>
  </section>
}

export function CoverageCauseDonut({ data, selected, onSelect }: { data: CriticalSparesData; selected: CoverageCause | 'ALL'; onSelect: (cause: CoverageCause) => void }) {
  const rows = coverageCauses(data)
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const selectedCount = selected === 'ALL' ? total : rows.find((row) => row.id === selected)?.count || 0
  return <section className="spares-panel cause-chart"><header><div><small>02 · POR QUÉ ESTOY DESCUBIERTO</small><h2>Causa de no cobertura</h2></div><span>Tipos, no unidades</span></header>
    {total ? <div className="cause-layout"><div className="cause-ring"><ResponsiveContainer width="100%" height={180}>
      <PieChart><Pie data={rows} dataKey="count" nameKey="name" innerRadius={56} outerRadius={78} startAngle={90} endAngle={-270} stroke="var(--sp-panel)" strokeWidth={3} isAnimationActive={false} onClick={(_entry, index) => onSelect(rows[index].id)}>{rows.map((row) => <Cell key={row.id} fill={row.color} cursor="pointer" className={selected === row.id ? 'cause-selected' : selected !== 'ALL' ? 'cause-muted' : ''} stroke={selected === row.id ? 'var(--sp-text)' : 'var(--sp-panel)'} />)}</Pie>
        <Tooltip content={({ active, payload }) => { const row = payload?.[0]?.payload; return active && row ? <div className="chart-tooltip"><strong>{row.name}</strong><span>{row.count} tipos · {row.percent}%</span></div> : null }} />
      </PieChart></ResponsiveContainer><div className="cause-center"><strong>{selectedCount}</strong><span>TIPOS<br />DESCUBIERTOS</span></div></div>
      <div className="cause-legend">{rows.map((row) => <button key={row.id} className={selected === row.id ? 'selected' : selected !== 'ALL' ? 'muted-selection' : ''} aria-pressed={selected === row.id} disabled={!row.count && selected !== row.id} onClick={() => onSelect(row.id)} title={`${row.name}: ${row.count} tipos (${row.percent}%). Click para filtrar; segundo click para quitar.`}><i style={{ background: row.count ? row.color : 'var(--sp-soft)' }} /><span>{row.name}</span><strong>{row.count}</strong><b>{row.percent}%</b></button>)}</div></div> : <div className="chart-empty"><strong>{data.spareTypes.length ? 'Sin repuestos descubiertos' : 'Sin repuestos para estos filtros'}</strong><span>{data.spareTypes.length ? 'Todos los tipos seleccionados tienen cobertura.' : 'Ajustá los filtros o registrá un repuesto.'}</span></div>}
    <p className="chart-footnote">Una causa por tipo: reparación → compra → sin acción. Segmentos y %: contexto antes del filtro de causa.</p>
  </section>
}

export function CoverageByGmbChart({ data, selected, onSelect, onList }: { data: CriticalSparesData; selected: string; onSelect: (id: string) => void; onList: (id: string) => void }) {
  const rows = coverageByGmb(data)
  return <section className="spares-panel gmb-chart"><header><div><small>03 · RESPONSABILIDAD ACTUAL</small><h2>Cobertura por Responsable</h2></div><span>Click en un responsable para filtrar el Dashboard</span></header>
    <div className="gmb-bars">{rows.map((row) => <div key={row.id} className={`gmb-row ${!row.areas.length || row.inactive ? 'low-priority' : ''} ${selected === row.id ? 'selected' : selected !== 'ALL' ? 'muted-selection' : ''}`}>
      <button className="gmb-main" aria-pressed={selected === row.id} onClick={() => onSelect(row.id)} title={`${row.name}\nÁreas: ${row.areas.join(', ') || 'Sin áreas asignadas'}\n${coverageText(row)}\nClick para filtrar el Dashboard. Segundo click para quitar.`}>
        <span className="gmb-person"><strong>{row.name}</strong><small>Áreas: {row.areas.join(' · ') || 'Sin áreas asignadas'}</small></span>{row.areas.length > 0 ? <CoverageBar row={row} /> : <span className="no-areas-bar" />}<b>{row.total ? `${row.percent}%` : '—'}</b><span>{row.total ? `${row.covered} / ${row.total}` : 'Sin datos'}</span><strong className={`gmb-risk ${row.uncovered ? '' : 'no-risk'}`}>{row.uncovered} sin cobertura</strong>
      </button><button className="gmb-list" onClick={() => onList(row.id)} aria-label={`Ver repuestos de ${row.name}`}>Ver repuestos ↗</button>
    </div>)}{!rows.length && <p className="chart-empty">Sin responsables configurados.</p>}</div><p className="chart-footnote">Comparativa entre responsables · respeta el resto de filtros activos.</p>
  </section>
}
