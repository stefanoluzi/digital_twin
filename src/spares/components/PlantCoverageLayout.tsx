import { useEffect, useMemo, useState } from 'react'
import { COVERAGE_TARGET_PERCENT, coverageByArea } from '../domain/dashboardSelectors'
import { coverageSummary } from '../domain/spareSelectors'
import { PLANT_LAYOUT_AREAS, type PlantLayoutArea } from '../plantLayoutAreas'
import type { CriticalSparesData } from '../types'
import plantLayoutImage from '../assets/plant-layout.png'
import { DEFAULT_PLANT_LAYOUT_ADJUSTMENT, readPlantLayoutAdjustments, savePlantLayoutAdjustments, type PlantLayoutAdjustment } from '../services/plantLayoutPreference'
import './plantCoverageLayout.css'

type CoverageRow = ReturnType<typeof coverageByArea>[number]
const SUMMARY_ORDER = ['COBA', 'HG', 'LP', 'LCO', 'ZTREF', 'HBM', 'LRE', 'PENF', 'SHA', 'CESTOS', 'REMA'] as const

function tone(row: CoverageRow) {
  return !row.total ? 'no-data' : row.percent >= COVERAGE_TARGET_PERCENT ? 'high' : row.percent >= 50 ? 'medium' : 'low'
}

function AreaOverlay({ area, row, hasPlantData, selected, adjustment, onOpen }: { area: PlantLayoutArea; row: CoverageRow; hasPlantData: boolean; selected: boolean; adjustment: PlantLayoutAdjustment; onOpen: () => void }) {
  const tooltip = row.total ? `${row.percent}% cobertura · ${row.covered} / ${row.total} críticos cubiertos · ${row.uncovered} sin cobertura` : hasPlantData ? 'Sin resultados para los filtros actuales; el área sí tiene repuestos registrados' : 'Sin datos: el área no tiene repuestos registrados para calcular cobertura'
  const coverageLabel = row.total ? `${row.percent}%` : '—'
  if (area.path) {
    const offsetX = adjustment.offsetX * 18.38
    const offsetY = adjustment.offsetY * 5.7
    const labelX = (area.labelX ?? 0) + offsetX
    const labelY = (area.labelY ?? 0) + offsetY
    const pathTransform = `translate(${offsetX} ${offsetY}) translate(${area.labelX ?? 0} ${area.labelY ?? 0}) scale(${adjustment.scaleX} ${adjustment.scaleY}) translate(${-(area.labelX ?? 0)} ${-(area.labelY ?? 0)})`
    return <><svg
    className={`plant-area-irregular tone-${tone(row)} ${selected ? 'selected' : ''}`}
    viewBox="0 0 1838 570"
    preserveAspectRatio="none"
    role="button"
    tabIndex={0}
    aria-label={`${area.id}: ${tooltip}. Ver repuestos`}
    onClick={onOpen}
    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen() } }}
  >
    <title>{area.id}: {tooltip}</title>
    <path d={area.path} transform={pathTransform} />
  </svg><span className={`plant-area-label plant-irregular-label-html tone-${tone(row)}`} aria-hidden="true" style={{ left: `${labelX / 18.38}%`, top: `${labelY / 5.7}%` }}><strong>{area.id}</strong><b>{coverageLabel}</b></span><span className={`plant-area-tooltip plant-irregular-tooltip tone-${tone(row)}`} role="tooltip" style={{ left: `${labelX / 18.38}%`, top: `${labelY / 5.7}%` }}><strong>{area.id}</strong><span>{row.total ? `${row.percent}% cobertura` : hasPlantData ? 'Sin resultados del filtro' : 'Sin datos para calcular cobertura'}</span><span>{row.covered} / {row.total} críticos cubiertos</span><span>{row.uncovered} repuestos sin cobertura</span></span></>
  }
  const adjusted = { left: area.x + adjustment.offsetX, top: area.y + adjustment.offsetY, width: area.width * adjustment.scaleX, height: area.height * adjustment.scaleY }
  return <button
    type="button"
    className={`plant-area-overlay tone-${tone(row)} ${selected ? 'selected' : ''}`}
    style={{ left: `${adjusted.left}%`, top: `${adjusted.top}%`, width: `${adjusted.width}%`, height: `${adjusted.height}%` }}
    onClick={onOpen}
    aria-label={`${area.id}: ${tooltip}. Ver repuestos`}
  >
    <span className="plant-area-label"><strong>{area.id}</strong><b>{coverageLabel}</b></span>
    <span className="plant-area-tooltip" role="tooltip"><strong>{area.id}</strong><span>{row.total ? `${row.percent}% cobertura` : hasPlantData ? 'Sin resultados del filtro' : 'Sin datos para calcular cobertura'}</span><span>{row.covered} / {row.total} críticos cubiertos</span><span>{row.uncovered} repuestos sin cobertura</span></span>
  </button>
}

function AreaCoverageCard({ row, hasPlantData, onOpen }: { row: CoverageRow; hasPlantData: boolean; onOpen: () => void }) {
  return <button type="button" className={`plant-coverage-card tone-${tone(row)}`} onClick={onOpen} aria-label={`Ver repuestos de ${row.id}`}>
    <span className="plant-card-heading"><strong>{row.id}</strong></span>
    <span className="plant-card-percent">{row.total ? `${row.percent}%` : hasPlantData ? 'Sin resultados' : 'Sin datos'}</span>
    <span className="plant-card-progress"><i style={{ width: `${row.percent}%` }} /></span>
    <span className="plant-card-detail"><span>Críticos cubiertos</span><b>{row.covered} / {row.total}</b></span>
    <span className="plant-card-detail"><span>Sin cobertura</span><b>{row.uncovered}</b></span>
  </button>
}

export function PlantCoverageLayout({ data, plantData, totalData, selectedArea, onOpenArea, showSummary = true }: { data: CriticalSparesData; plantData: CriticalSparesData; totalData: CriticalSparesData; selectedArea: string; onOpenArea: (id: string) => void; showSummary?: boolean }) {
  const [zoom, setZoom] = useState(1)
  const [showLabels, setShowLabels] = useState(true)
  const [editingAreas, setEditingAreas] = useState(false)
  const [editingAreaId, setEditingAreaId] = useState<string>('HG')
  const [adjustments, setAdjustments] = useState(readPlantLayoutAdjustments)
  useEffect(() => savePlantLayoutAdjustments(adjustments), [adjustments])
  const rows = useMemo(() => coverageByArea(data, 'operational'), [data])
  const rowById = new Map(rows.map((row) => [row.id, row]))
  const plantRowById = new Map(coverageByArea(plantData, 'operational').map((row) => [row.id, row]))
  const total = coverageSummary(totalData)
  return <div className="plant-coverage-view">
    <section className="spares-panel plant-layout-panel">
      <header><div><small>COBERTURA · VISTA DE PLANTA</small><h2>Cobertura por Layout</h2></div><div className="plant-map-tools"><label>Zoom <select aria-label="Zoom del plano" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></label><button type="button" onClick={() => setZoom(1)}>Ajustar plano</button><button type="button" aria-pressed={showLabels} onClick={() => setShowLabels((value) => !value)}>{showLabels ? 'Ocultar etiquetas' : 'Mostrar etiquetas'}</button><button type="button" className={editingAreas ? 'active' : ''} aria-pressed={editingAreas} onClick={() => setEditingAreas((value) => !value)}>{editingAreas ? 'Finalizar ajuste' : 'Ajustar áreas'}</button></div></header>
      <div className="plant-map-scroll"><div className={`plant-map-stage ${showLabels ? '' : 'labels-hidden'}`} style={{ width: `${zoom * 100}%`, minWidth: `${zoom * 760}px` }}>
        <img src={plantLayoutImage} alt="Plano original del Laminador Continuo 1" width="1838" height="570" />
        {PLANT_LAYOUT_AREAS.map((area) => <AreaOverlay key={area.id} area={area} row={rowById.get(area.id)!} hasPlantData={Boolean(plantRowById.get(area.id)?.total)} selected={(editingAreas ? editingAreaId : selectedArea) === area.id} adjustment={adjustments[area.id] ?? DEFAULT_PLANT_LAYOUT_ADJUSTMENT} onOpen={() => editingAreas ? setEditingAreaId(area.id) : onOpenArea(area.id)} />)}
      </div></div>
      {editingAreas && <LayoutAreaEditor areaId={editingAreaId} value={adjustments[editingAreaId] ?? DEFAULT_PLANT_LAYOUT_ADJUSTMENT} onSelect={setEditingAreaId} onChange={(value) => setAdjustments((current) => ({ ...current, [editingAreaId]: value }))} onReset={() => setAdjustments((current) => { const next = { ...current }; delete next[editingAreaId]; return next })} />}
      <div className="plant-map-footer"><span>PLANO ORIGINAL · LC1C</span><span>Seleccioná un área para ver sus repuestos</span></div>
    </section>
    {showSummary && <section className="spares-panel plant-summary-panel" aria-label="Resumen de cobertura por área">
      <header><div><small>INDICADORES DE COBERTURA</small><h2>Cobertura de repuestos por área</h2></div><div className="plant-coverage-legend"><span className="tone-high">● Alta ≥ {COVERAGE_TARGET_PERCENT}%</span><span className="tone-medium">● Media 50–{COVERAGE_TARGET_PERCENT - 1}%</span><span className="tone-low">● Baja &lt; 50%</span><span className="tone-no-data">● Sin datos</span></div></header>
      <div className="plant-coverage-summary">
        {SUMMARY_ORDER.map((id) => <AreaCoverageCard key={id} row={rowById.get(id)!} hasPlantData={Boolean(plantRowById.get(id)?.total)} onOpen={() => onOpenArea(id)} />)}
        <article className="plant-coverage-total"><small>SELECCIÓN ACTUAL</small><strong>{total.total ? `${total.percent}%` : 'Sin datos'}</strong><span>Críticos cubiertos <b>{total.covered} / {total.total}</b></span><span>Sin cobertura <b>{total.uncovered}</b></span></article>
      </div>
    </section>}
  </div>
}

function LayoutAreaEditor({ areaId, value, onSelect, onChange, onReset }: { areaId: string; value: PlantLayoutAdjustment; onSelect: (id: string) => void; onChange: (value: PlantLayoutAdjustment) => void; onReset: () => void }) {
  const control = (key: keyof PlantLayoutAdjustment, label: string, min: number, max: number, step: number, suffix: string) => <label><span>{label}<b>{value[key].toFixed(key.startsWith('scale') ? 2 : 1)}{suffix}</b></span><input type="range" min={min} max={max} step={step} value={value[key]} onChange={(event) => onChange({ ...value, [key]: Number(event.target.value) })} /></label>
  return <section className="plant-area-editor" aria-label="Ajuste de delimitaciones"><header><div><small>CALIBRACIÓN VISUAL</small><strong>Ajustar delimitación</strong></div><select aria-label="Área a ajustar" value={areaId} onChange={(event) => onSelect(event.target.value)}>{PLANT_LAYOUT_AREAS.map((area) => <option key={area.id} value={area.id}>{area.id}</option>)}</select><button type="button" onClick={onReset}>Restablecer esta área</button></header><div>{control('offsetX', 'Posición horizontal', -10, 10, .1, '%')}{control('offsetY', 'Posición vertical', -10, 10, .1, '%')}{control('scaleX', 'Ancho', .5, 1.5, .01, '×')}{control('scaleY', 'Alto', .5, 1.5, .01, '×')}</div><p>Los cambios se guardan automáticamente en este navegador. Mientras este modo está activo, seleccioná una zona del plano para editarla.</p></section>
}
