import { CircleDashed, Wrench, PauseCircle, CircleCheck, TriangleAlert } from 'lucide-react'
import { toggleFilter, type StateFilter } from './meetingFilters'

const references = [
  { value: 'PENDING', tone: 'planned', label: 'Pendiente', Icon: CircleDashed },
  { value: 'IN_PROGRESS', tone: 'progress', label: 'En curso', Icon: Wrench },
  { value: 'BLOCKED', tone: 'blocked', label: 'Bloqueada', Icon: PauseCircle },
  { value: 'DELIVERED', tone: 'delivered', label: 'Entregada', Icon: CircleCheck },
  { value: 'OVERDUE', tone: 'late', label: 'Vencida', Icon: TriangleAlert },
] as const

export function RepairPlanLegend({ selected = [], onChange = () => {} }: { selected?: StateFilter[]; onChange?: (selected: StateFilter[]) => void }) {
  return <section className="repair-plan-legend" aria-label="Filtrar por estados">
    <div className="repair-legend-items" role="group" aria-label="Estados de reparación">{references.map(({ value, tone, label, Icon }) => <button type="button" key={tone} aria-pressed={selected.includes(value)} className={`repair-status ${tone}`} onClick={(event) => onChange(toggleFilter(selected, value, event))}><Icon aria-hidden="true" /><strong>{label}</strong></button>)}</div>
  </section>
}
