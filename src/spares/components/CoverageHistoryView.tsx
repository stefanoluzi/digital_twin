import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { coverageChange, groupProgress, type CoverageGroup, type CoverageHistoryResponse, type CoverageMetrics, type CoveragePoint, type HistoryPeriod } from '../domain/coverageHistory'
import './coverageHistory.css'

const date = (value: string | null) => value ? new Date(value).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : '—'
const percent = (value?: CoverageMetrics | null) => value?.total ? `${value.percent}%` : '—'
const delta = (value: number | null, unit = 'pp') => value === null ? '—' : `${value > 0 ? '+' : ''}${value} ${unit}`
const colors = ['var(--sp-accent)', 'var(--sp-green)', 'var(--sp-yellow)', 'var(--sp-red)', '#6477b6', '#568d91', '#957043', '#6b859b', '#868846', '#a16345', '#626d85']
const periods: [HistoryPeriod, string][] = [['7', '7 días'], ['30', '30 días'], ['90', '90 días'], ['180', '6 meses'], ['365', '1 año'], ['ALL', 'Todo'], ['CUSTOM', 'Personalizado']]

export function CoverageHistoryView({ refreshKey }: { refreshKey: string }) {
  const [period, setPeriod] = useState<HistoryPeriod>('30')
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [until, setUntil] = useState(new Date().toISOString().slice(0, 10))
  const [result, setResult] = useState<CoverageHistoryResponse | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const abort = new AbortController()
    setError(''); setResult(null)
    const query = new URLSearchParams({ period, from, until })
    void fetch(`/api/coverage-history?${query}`, { signal: abort.signal }).then(async (response) => {
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'No se pudo consultar el histórico.')
      if (!abort.signal.aborted) setResult(body)
    }).catch((failure: unknown) => { if (!abort.signal.aborted) setError(failure instanceof Error ? failure.message : 'Error de conexión con el servidor.') })
    return () => abort.abort()
  }, [period, from, until, refreshKey, retry])
  const current = result?.current
  const baseline = result?.baseline || (result && result.points.length > 1 ? result.points[0] : null)
  const groups = current?.groups || []
  const progress = (group: CoverageGroup) => groupProgress(group, result?.thirtyDaysAgo?.groups.find((item) => item.dimension === group.dimension && item.key === group.key), result!.until, result!.warningDays, result!.criticalDays)
  const areas = groups.filter((group) => group.dimension === 'AREA').sort((a, b) => b.uncovered - a.uncovered || b.total - a.total)
  const gmbs = groups.filter((group) => group.dimension === 'GMB')
  return <div className="coverage-history">
    <section className="spares-panel"><header><div><small>HISTÓRICOS</small><h2>Evolución de cobertura de repuestos críticos</h2></div><div className="history-controls"><label>Período<select value={period} onChange={(event) => setPeriod(event.target.value as HistoryPeriod)}>{periods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{period === 'CUSTOM' && <><label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>Hasta<input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label></>}</div></header>
      <p className="history-note">{result?.availableSince ? `Histórico disponible desde ${date(result.availableSince)}. ` : ''}Datos globales, sin los filtros temporales de Repuestos. Fechas en UTC.</p>
    </section>
    {error ? <section className="spares-panel history-message" role="alert">{error} <button onClick={() => setRetry(retry + 1)}>Reintentar</button></section> : !result ? <p role="status">Consultando histórico en PostgreSQL…</p> : !current ? <p>No hay registros para el período seleccionado.</p> : <>
      <section className="coverage-kpis history-kpis">
        <Kpi label={period === 'CUSTOM' ? 'COBERTURA AL CIERRE' : 'COBERTURA ACTUAL'} value={percent(current)} note={`${current.covered} de ${current.total} repuestos cubiertos`} />
        <Kpi label="VARIACIÓN DEL PERÍODO" value={delta(coverageChange(baseline, current))} note={baseline ? `Desde ${date(result.baseline ? result.from : baseline.capturedAt)}` : 'Sin comparación anterior'} />
        <Kpi label="SIN COBERTURA" value={String(current.uncovered)} note="repuestos descubiertos" />
        <Kpi label="REDUCCIÓN DEL PERÍODO" value={delta(baseline ? current.uncovered - baseline.uncovered : null, 'repuestos')} note="Negativo = menos descubiertos" />
        <Kpi label="ÁREAS ESTANCADAS" value={String(areas.filter((group) => progress(group).stagnant).length)} note={`Sin mejora ≥ ${result.warningDays} días`} />
        <Kpi label="GMB SIN AVANCE" value={String(gmbs.filter((group) => progress(group).stagnant).length)} note={`Crítico ≥ ${result.criticalDays} días`} />
      </section>
      {!result.baseline && <p className="history-note">El registro comenzó dentro del período elegido. Las variaciones usan únicamente el tramo observado; no se completan fechas anteriores.</p>}
      <HistoryChart result={result} title="Evolución de cobertura global" />
      <HistoryChart result={result} title="Evolución por área" dimension="AREA" />
      <HistoryChart result={result} title="Evolución por responsable GMB" dimension="GMB" />
      <section className="spares-panel"><header><div><small>GESTIÓN · MAYOR CANTIDAD SIN COBERTURA PRIMERO</small><h2>Puntos de atención</h2></div></header><div className="history-table"><table><thead><tr>{['Área', 'GMB', 'Cobertura', 'Hace 30 días', 'Variación', 'Sin cobertura', 'Última mejora', 'Días sin avance', 'Estado'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{areas.map((group) => {
        const value = progress(group)
        return <tr key={group.key}><td>{group.key}</td><td>{group.responsibleName || '—'}</td><td>{percent(group)}</td><td>{percent(result.thirtyDaysAgo?.groups.find((item) => item.dimension === 'AREA' && item.key === group.key))}</td><td>{delta(value.change)}</td><td>{group.uncovered}</td><td>{date(group.lastImprovedAt)}</td><td>{value.days ?? '—'}</td><td><Status value={value.status} /></td></tr>
      })}</tbody></table></div><p className="history-note">Sin mejora registrada: los días se cuentan desde el primer relevamiento observado. “—” indica que no existe comparación. Alerta a los {result.warningDays} días; crítica a los {result.criticalDays} días.</p></section>
      <section className="spares-panel"><header><h2>Avance por responsable</h2></header><div className="history-gmb">{gmbs.map((group) => {
        const value = progress(group)
        const previous = result.thirtyDaysAgo?.groups.find((item) => item.dimension === 'GMB' && item.key === group.key)
        return <article className="coverage-kpi" key={group.key}><h3>{group.name}</h3><small>{group.areaIds.join(' · ')}</small><dl><dt>Cobertura</dt><dd>{percent(group)}</dd><dt>Hace 30 días</dt><dd>{percent(previous)}</dd><dt>Variación</dt><dd>{delta(value.change)}</dd><dt>Sin cobertura</dt><dd>{group.uncovered}</dd><dt>Días sin avance</dt><dd>{value.days ?? '—'}</dd><dt>Última mejora</dt><dd>{date(group.lastImprovedAt)}</dd></dl><Status value={value.status} /></article>
      })}{!gmbs.length && <p>No hay responsables con áreas asignadas en este registro.</p>}</div></section>
      <p className="history-note">Los cambios de universo y de asignación pueden modificar el porcentaje sin representar una recuperación física. Los gráficos conservan total, cubiertos y descubiertos, con la asignación vigente en cada fecha.</p>
    </>}
  </div>
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) { return <article className="coverage-kpi"><span>{label}</span><strong>{value}</strong><small>{note}</small></article> }
function Status({ value }: { value: string }) { const tone = value === 'Retroceso' || value === 'Sin avance crítico' ? 'risk' : value === 'Sin avance' ? 'warning' : value === 'Cubierto' || value === 'Avanzando' ? 'good' : ''; return <span className={`history-status ${tone}`}>{value}</span> }

function HistoryChart({ result, title, dimension }: { result: CoverageHistoryResponse; title: string; dimension?: 'AREA' | 'GMB' }) {
  const [chosen, setChosen] = useState<string[] | null>(null)
  const points = useMemo(() => {
    const all: CoveragePoint[] = result.baseline ? [{ ...result.baseline, capturedAt: result.from }, ...result.points] : [...result.points]
    if (result.current && all.length && all[all.length - 1].capturedAt !== result.until) all.push({ ...result.current, capturedAt: result.until })
    return all
  }, [result])
  const available = [...new Map(points.flatMap((point) => point.groups.filter((group) => group.dimension === dimension).map((group) => [group.key, group] as const))).values()]
  const selected = chosen ?? [...available].filter((group) => group.total > 0).sort((a, b) => b.uncovered - a.uncovered || b.total - a.total).slice(0, 3).map((group) => group.key)
  const lines = dimension ? available.filter((group) => selected.includes(group.key)).map((group) => ({ key: group.key, name: dimension === 'AREA' ? group.key : group.name })) : [{ key: 'global', name: 'Planta' }]
  const rows = points.map((point) => ({ time: Date.parse(point.capturedAt), point, ...Object.fromEntries(lines.map((line, index) => { const metrics = dimension ? point.groups.find((group) => group.dimension === dimension && group.key === line.key) : point; return [`value${index}`, metrics?.total ? metrics.percent : null] })) }))
  return <section className="spares-panel"><header><h2>{title}</h2></header>{dimension && <div className="history-selectors"><button className="ghost" onClick={() => setChosen(available.map((group) => group.key))}>Todas</button><button className="ghost" onClick={() => setChosen([])}>Ninguna</button>{available.map((group) => <label key={group.key}><input type="checkbox" checked={selected.includes(group.key)} onChange={(event) => setChosen(event.target.checked ? [...selected, group.key] : selected.filter((key) => key !== group.key))} />{dimension === 'AREA' ? group.key : group.name}</label>)}</div>}
    <div className="history-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 16, right: 24, bottom: 12, left: 0 }}><CartesianGrid stroke="var(--sp-line)" strokeDasharray="3 3" /><XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(value: number) => rows.length && rows[rows.length - 1].time - rows[0].time < 86400000 ? new Date(value).toLocaleTimeString('es-AR', { timeZone: 'UTC' }) : date(new Date(value).toISOString())} minTickGap={50} /><YAxis domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} />
      <Tooltip content={({ active, payload }) => { const row = payload?.[0]?.payload as { point: CoveragePoint; time: number } | undefined; if (!active || !row) return null; return <div className="history-tooltip"><b>{date(new Date(row.time).toISOString())} · {new Date(row.time).toLocaleTimeString('es-AR', { timeZone: 'UTC' })} UTC</b>{lines.map((line) => { const metrics = dimension ? row.point.groups.find((group) => group.dimension === dimension && group.key === line.key) : row.point; return metrics && <p key={line.key}><b>{'name' in metrics ? metrics.name : line.name}: {percent(metrics)}</b><br />Cubiertos: {metrics.covered} · Sin cobertura: {metrics.uncovered} · Total: {metrics.total}{'responsibleName' in metrics && <><br />{dimension === 'AREA' ? metrics.responsibleName : metrics.areaIds.join(' · ')}</>}</p> })}</div> }} />
      {lines.map((line, index) => <Line key={line.key} name={line.name} dataKey={`value${index}`} type="stepAfter" stroke={colors[index % colors.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />)}
    </LineChart></ResponsiveContainer></div><div className="history-legend">{lines.map((line, index) => <span key={line.key}><i style={{ background: colors[index % colors.length] }} />{line.name}</span>)}</div>
    <p className="history-note">{result.points.length + Number(Boolean(result.baseline)) < 2 ? 'Un solo registro disponible; aún no hay cambios para comparar. ' : ''}La línea mantiene el último estado conocido hasta el cierre; no representa mediciones adicionales.{dimension && ' Sin repuestos relevados: no se dibuja porcentaje.'}</p>
  </section>
}
