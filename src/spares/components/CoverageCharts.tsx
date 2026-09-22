import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CriticalSparesData } from '../types'
import { COVERAGE_TARGET_PERCENT, coverageByArea, coverageByGmb, coverageCauses, type CoverageCause } from '../domain/dashboardSelectors'
import './coverageCharts.css'

type CoverageRow = ReturnType<typeof coverageByArea>[number]
function CoverageBar({ row }: { row: Pick<CoverageRow, 'total' | 'covered' | 'percent'> }) {
  const color = !row.total ? 'var(--sp-soft)' : row.percent >= COVERAGE_TARGET_PERCENT ? 'var(--sp-green)' : row.percent >= 50 ? 'var(--sp-yellow)' : 'var(--sp-red)'
  return <span className={`executive-bar ${!row.total ? 'empty-track' : row.covered === 0 ? 'risk-track' : ''}`} aria-hidden="true">
    <ResponsiveContainer width="100%" height={16}>
      <BarChart layout="vertical" data={[row]} margin={{ top: 0, bottom: 0, left: 0, right: 0 }}>
        <XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" hide />
        <Bar dataKey="percent" fill={color} barSize={12}  isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  </span>
}

function coverageText(row: Pick<CoverageRow, 'total' | 'covered' | 'percent' | 'uncovered' | 'repair' | 'purchase'>, hasPlantData = false) {
  return row.total ? `Cobertura: ${row.percent}% · ${row.covered} de ${row.total} repuestos cubiertos\n${row.uncovered} repuestos sin cubrir\n${row.repair} unidades en reparación · ${row.purchase} unidades en compra` : hasPlantData ? 'Sin resultados: el área tiene repuestos registrados, pero ninguno coincide con los filtros actuales' : 'Sin datos: el área no tiene repuestos registrados para calcular cobertura'
}

export function CoverageByAreaChart({ rows, onSelect }: { rows: CoverageRow[]; onSelect: (id: string) => void }) {
  const withData = rows.filter((row) => row.total > 0)
  const pending = rows.filter((row) => row.total === 0)
  return <section className="spares-panel area-chart"><header><h2>Cobertura por área</h2><span>Menor a mayor cobertura</span></header>
    <div className="executive-bars">{withData.map((row) => <button className={`bar-main executive-row ${row.covered === 0 ? 'uncovered-area' : ''}`} key={row.id} title={`${row.name}: ${row.percent}% de cobertura, ${row.covered} de ${row.total} repuestos cubiertos. Ver repuestos del área.`} onClick={() => onSelect(row.id)} aria-label={`${row.id}: ${row.percent}% de cobertura, ${row.covered} de ${row.total} cubiertos. Ver repuestos`}>
      <strong className="bar-label">{row.id}</strong><CoverageBar row={row} /><b className="bar-percent">{row.percent}%</b><span className="bar-ratio">{row.covered} / {row.total}</span>
    </button>)}{!withData.length && <p className="chart-footnote">Todavía no hay áreas con repuestos relevados.</p>}</div>
    {pending.length > 0 && <div className="pending-areas"><strong>{pending.length} {pending.length === 1 ? 'área pendiente' : 'áreas pendientes'} de relevamiento</strong><span>{pending.map((row) => row.id).join(' · ')}</span></div>}
  </section>
}

function areaTone(row: CoverageRow) {
  return !row.total ? 'no-data' : row.percent >= COVERAGE_TARGET_PERCENT ? 'high' : row.percent >= 50 ? 'medium' : 'low'
}

export function CoverageByAreaCards({ rows, onSelect, showLayout, onToggleLayout }: { rows: CoverageRow[]; onSelect: (id: string) => void; showLayout: boolean; onToggleLayout: () => void }) {
  return <section className="spares-panel area-coverage-cards">
    <header><div><small>COBERTURA DE REPUESTOS POR ÁREA</small><h2>Cobertura por área</h2></div><div className="area-card-actions"><span className="area-card-legend"><i className="tone-high" />Alta ≥ {COVERAGE_TARGET_PERCENT}% <i className="tone-medium" />Media 50–{COVERAGE_TARGET_PERCENT - 1}% <i className="tone-low" />Baja &lt; 50%</span><button type="button" className={showLayout ? 'active' : ''} aria-pressed={showLayout} onClick={onToggleLayout}>{showLayout ? 'Ocultar layout' : 'Ver layout de planta'}</button></div></header>
    <div className="area-card-grid">
      {rows.map((row) => <button type="button" key={row.id} className={`area-coverage-card tone-${areaTone(row)}`} onClick={() => onSelect(row.id)} aria-label={`${row.id}: ${row.total ? `${row.percent}% de cobertura, ${row.covered} de ${row.total} cubiertos` : 'sin datos'}. Ver repuestos`}>
        <strong>{row.id}</strong><b>{row.total ? `${row.percent}%` : 'Sin datos'}</b><span className="area-card-progress"><i style={{ width: `${row.percent}%` }} /></span><span>Críticos cubiertos <em>{row.covered} / {row.total}</em></span><span>Sin cobertura <em>{row.uncovered}</em></span>
      </button>)}
    </div>
  </section>
}

export function CoverageCauseDonut({ data, selected, onSelect }: { data: CriticalSparesData; selected: CoverageCause | 'ALL'; onSelect: (cause: CoverageCause) => void }) {
  const rows = coverageCauses(data)
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const selectedCount = selected === 'ALL' ? total : rows.find((row) => row.id === selected)?.count || 0
  const noAction = rows.find((row) => row.id === 'NO_ACTION')?.count ?? 0
  return <section className="spares-panel cause-chart"><header><div><small>02 · POR QUÉ ESTOY DESCUBIERTO</small><h2>Causa de no cobertura</h2></div><span>Repuestos sin cubrir</span></header>
    <div className="cause-status"><span><b>{total - noAction}</b> descubiertos con acción en curso</span><strong><b>{noAction}</b> sin plan de acción</strong></div>
    {total ? <div className="cause-layout"><div className="cause-ring"><ResponsiveContainer width="100%" height={180}>
      <PieChart><Pie data={rows} dataKey="count" nameKey="name" innerRadius={56} outerRadius={78} startAngle={90} endAngle={-270} stroke="var(--sp-panel)" strokeWidth={3} isAnimationActive={false} onClick={(_entry, index) => onSelect(rows[index].id)}>{rows.map((row) => <Cell key={row.id} fill={row.color} cursor="pointer" className={selected === row.id ? 'cause-selected' : selected !== 'ALL' ? 'cause-muted' : ''} stroke={selected === row.id ? 'var(--sp-text)' : 'var(--sp-panel)'} />)}</Pie>
        <Tooltip content={({ active, payload }) => { const row = payload?.[0]?.payload; return active && row ? <div className="chart-tooltip"><strong>{row.name}</strong><span>{row.count} repuestos · {row.percent}%</span></div> : null }} />
      </PieChart></ResponsiveContainer><div className="cause-center"><strong>{selectedCount}</strong><span>REPUESTOS<br />SIN CUBRIR</span></div></div>
      <div className="cause-legend">{rows.map((row) => <button key={row.id} className={`${row.id === 'NO_ACTION' ? 'no-action-cause' : ''} ${selected === row.id ? 'selected' : selected !== 'ALL' ? 'muted-selection' : ''}`} aria-pressed={selected === row.id} disabled={!row.count && selected !== row.id} onClick={() => onSelect(row.id)} title={`${row.name}: ${row.count} repuestos (${row.percent}%). Click para filtrar; segundo click para quitar.`}><i style={{ background: row.count ? row.color : 'var(--sp-soft)' }} /><span>{row.name}</span><strong>{row.count}</strong><b>{row.percent}%</b></button>)}</div></div> : <div className="chart-empty"><strong>{data.spareTypes.length ? 'Sin repuestos descubiertos' : 'Sin repuestos para estos filtros'}</strong><span>{data.spareTypes.length ? 'Todos los repuestos seleccionados tienen cobertura.' : 'Ajustá los filtros o registrá un repuesto.'}</span></div>}
    <p className="chart-footnote">Una causa por repuesto sin cubrir: reparación → compra → sin acción. Segmentos y %: contexto antes del filtro de causa.</p>
  </section>
}

export function CoverageByGmbChart({ data, selected, onSelect, onList }: { data: CriticalSparesData; selected: string; onSelect: (id: string) => void; onList: (id: string) => void }) {
  const rows = coverageByGmb(data)
  return <section className="spares-panel gmb-chart"><header><div><small>RESPONSABLES GMB</small><h2>Cobertura por responsable</h2></div><span>Seleccioná un responsable para ver sus repuestos</span></header>
    <div className="gmb-bars">{rows.map((row) => <div key={row.id} className={`gmb-row ${!row.areas.length || row.inactive ? 'low-priority' : ''} ${selected === row.id ? 'selected' : selected !== 'ALL' ? 'muted-selection' : ''}`}>
      <button className="gmb-main" aria-pressed={selected === row.id} onClick={() => onSelect(row.id)} title={`${row.name}\nÁreas: ${row.areas.join(', ') || 'Sin áreas asignadas'}\n${coverageText(row)}\nVer repuestos del responsable.`}>
        <span className="gmb-person"><strong>{row.name}</strong><small>Áreas: {row.areas.join(' · ') || 'Sin áreas asignadas'}</small></span>{row.areas.length > 0 ? <CoverageBar row={row} /> : <span className="no-areas-bar" />}<b>{row.total ? `${row.percent}%` : '—'}</b><span>{row.total ? `${row.covered} / ${row.total}` : 'Sin datos'}</span><strong className={`gmb-risk ${row.uncovered ? '' : 'no-risk'}`}>{row.uncovered} sin cobertura</strong>
      </button><button className="gmb-list" onClick={() => onList(row.id)} aria-label={`Ver repuestos de ${row.name}`}>Ver repuestos ↗</button>
    </div>)}{!rows.length && <p className="chart-empty">Sin responsables configurados.</p>}</div><p className="chart-footnote">Comparativa por GMB según las áreas asignadas a cada responsable.</p>
  </section>
}
