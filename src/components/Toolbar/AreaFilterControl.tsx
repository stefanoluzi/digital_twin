import { AREA_FILTER_ALL, PLANT_AREAS, areaLabel, type AreaFilter } from '../../config/areas'

export function AreaFilterControl({ value, onChange, onFocus }: { value: AreaFilter; onChange: (area: AreaFilter) => void; onFocus: () => void }) {
  return (
    <div className="area-filter-control" role="group" aria-label="Filtro por área">
      <label><span>Área</span><select aria-label="Filtrar por área" value={value} onChange={(event) => onChange(event.target.value as AreaFilter)}>
        <option value={AREA_FILTER_ALL}>Todas las áreas</option>
        {PLANT_AREAS.map((area) => <option key={area.code} value={area.code}>{areaLabel(area.code)}</option>)}
      </select></label>
      <button disabled={value === AREA_FILTER_ALL} title="Enfocar área seleccionada" aria-label="Enfocar área seleccionada" onClick={onFocus}>◎</button>
    </div>
  )
}
