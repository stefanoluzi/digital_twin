import { useState, type ReactNode } from 'react'

export function PlanFilterBar({ search, area, secondary, activeCount, nextMonth, onNextMonth, onClear }: {
  search: ReactNode; area: ReactNode; secondary: ReactNode; activeCount: number;
  nextMonth: boolean; onNextMonth: (active: boolean) => void; onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false)
  const count = activeCount + Number(nextMonth)
  return <div className="plan-filter-controls">
    <div className="plan-filter-primary">{search}{area}<button type="button" className="ghost" aria-expanded={expanded} aria-controls="plan-secondary-filters" onClick={() => setExpanded(!expanded)}>Más filtros{count ? ` (${count})` : ''} {expanded ? '▴' : '▾'}</button><button type="button" className="ghost" onClick={onClear}>Limpiar</button></div>
    <div id="plan-secondary-filters" className="plan-filter-secondary" hidden={!expanded}>{secondary}<label className="repairs-check"><input type="checkbox" checked={nextMonth} onChange={(e) => onNextMonth(e.target.checked)} />Próximo mes</label></div>
  </div>
}
