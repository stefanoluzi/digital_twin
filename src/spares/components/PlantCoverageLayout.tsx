import { useMemo, useState } from 'react'
import { COVERAGE_TARGET_PERCENT, coverageByArea } from '../domain/dashboardSelectors'
import { coverageSummary } from '../domain/spareSelectors'
import { PLANT_LAYOUT_AREAS, type PlantLayoutArea } from '../plantLayoutAreas'
import type { CriticalSparesData } from '../types'
import plantLayoutImage from '../assets/plant-layout.png'
import './plantCoverageLayout.css'

type CoverageRow = ReturnType<typeof coverageByArea>[number]
const SUMMARY_ORDER = ['COBA', 'HG', 'LP', 'LCO', 'ZTREF', 'HBM', 'LRE', 'PENF', 'SHA', 'CESTOS', 'REMA'] as const

function tone(row: CoverageRow) {
  return !row.total ? 'no-data' : row.percent >= COVERAGE_TARGET_PERCENT ? 'high' : row.percent >= 50 ? 'medium' : 'low'
}

function AreaOverlay({ area, row, hasPlantData, selected, onOpen }: { area: PlantLayoutArea; row: CoverageRow; hasPlantData: boolean; selected: boolean; onOpen: () => void }) {
  const tooltip = row.total ? `${row.percent}% cobertura · ${row.covered} / ${row.total} críticos cubiertos · ${row.uncovered} sin cobertura` : hasPlantData ? 'Sin resultados para los filtros actuales; el área sí tiene repuestos registrados' : 'Sin datos: el área no tiene repuestos registrados para calcular cobertura'
  if (area.path) return <svg
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
    <path d={area.path} />
    <g className="plant-irregular-label" aria-hidden="true"><rect x={(area.labelX ?? 0) - 43} y={(area.labelY ?? 0) - 18} width="86" height="36" rx="6" /><text x={area.labelX} y={(area.labelY ?? 0) + 9} textAnchor="middle">{area.id}</text></g>
  </svg>
  return <button
    type="button"
    className={`plant-area-overlay tone-${tone(row)} ${selected ? 'selected' : ''}`}
    style={{ left: `${area.x}%`, top: `${area.y}%`, width: `${area.width}%`, height: `${area.height}%` }}
    onClick={onOpen}
    aria-label={`${area.id}: ${tooltip}. Ver repuestos`}
  >
    <span className="plant-area-label">{area.id}</span>
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

export function PlantCoverageLayout({ data, plantData, totalData, selectedArea, onOpenArea }: { data: CriticalSparesData; plantData: CriticalSparesData; totalData: CriticalSparesData; selectedArea: string; onOpenArea: (id: string) => void }) {
  const [zoom, setZoom] = useState(1)
  const [showLabels, setShowLabels] = useState(true)
  const rows = useMemo(() => coverageByArea(data, 'operational'), [data])
  const rowById = new Map(rows.map((row) => [row.id, row]))
  const plantRowById = new Map(coverageByArea(plantData, 'operational').map((row) => [row.id, row]))
  const total = coverageSummary(totalData)
  return <div className="plant-coverage-view">
    <section className="spares-panel plant-layout-panel">
      <header><div><small>COBERTURA · VISTA DE PLANTA</small><h2>Cobertura por Layout</h2></div><div className="plant-map-tools"><label>Zoom <select aria-label="Zoom del plano" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option></select></label><button type="button" onClick={() => setZoom(1)}>Ajustar</button><button type="button" aria-pressed={showLabels} onClick={() => setShowLabels((value) => !value)}>{showLabels ? 'Ocultar etiquetas' : 'Mostrar etiquetas'}</button></div></header>
      <div className="plant-map-scroll"><div className={`plant-map-stage ${showLabels ? '' : 'labels-hidden'}`} style={{ width: `${zoom * 100}%`, minWidth: `${zoom * 760}px` }}>
        <img src={plantLayoutImage} alt="Plano original del Laminador Continuo 1" width="1838" height="570" />
        {PLANT_LAYOUT_AREAS.map((area) => <AreaOverlay key={area.id} area={area} row={rowById.get(area.id)!} hasPlantData={Boolean(plantRowById.get(area.id)?.total)} selected={selectedArea === area.id} onOpen={() => onOpenArea(area.id)} />)}
      </div></div>
      <div className="plant-map-footer"><span>PLANO ORIGINAL · LC1C</span><span>Seleccioná un área para ver sus repuestos</span></div>
    </section>
    <section className="spares-panel plant-summary-panel" aria-label="Resumen de cobertura por área">
      <header><div><small>INDICADORES DE COBERTURA</small><h2>Cobertura de repuestos por área</h2></div><div className="plant-coverage-legend"><span className="tone-high">● Alta ≥ {COVERAGE_TARGET_PERCENT}%</span><span className="tone-medium">● Media 50–{COVERAGE_TARGET_PERCENT - 1}%</span><span className="tone-low">● Baja &lt; 50%</span><span className="tone-no-data">● Sin datos</span></div></header>
      <div className="plant-coverage-summary">
        {SUMMARY_ORDER.map((id) => <AreaCoverageCard key={id} row={rowById.get(id)!} hasPlantData={Boolean(plantRowById.get(id)?.total)} onOpen={() => onOpenArea(id)} />)}
        <article className="plant-coverage-total"><small>SELECCIÓN ACTUAL</small><strong>{total.total ? `${total.percent}%` : 'Sin datos'}</strong><span>Críticos cubiertos <b>{total.covered} / {total.total}</b></span><span>Sin cobertura <b>{total.uncovered}</b></span></article>
      </div>
    </section>
  </div>
}
