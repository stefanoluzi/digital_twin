import { CircleDashed, Wrench, PauseCircle, CircleCheck, TriangleAlert, Info } from 'lucide-react'

const references = [
  { tone: 'planned', label: 'Pendiente', description: 'Trabajo aún sin iniciar', Icon: CircleDashed },
  { tone: 'progress', label: 'En curso', description: 'Trabajo en ejecución', Icon: Wrench },
  { tone: 'blocked', label: 'Bloqueada', description: 'Requiere resolver un bloqueo', Icon: PauseCircle },
  { tone: 'delivered', label: 'Entregada', description: 'Todas las unidades entregadas', Icon: CircleCheck },
  { tone: 'late', label: 'Vencida', description: 'Plazo superado · Prioridad visual', Icon: TriangleAlert },
] as const

export function RepairPlanLegend() {
  return <section className="repair-plan-legend" aria-label="Referencias de colores del plan">
    <div className="repair-legend-heading"><h3>Cómo leer el plan</h3><span>El color indica la situación de cada celda</span></div>
    <ul className="repair-legend-items">{references.map(({ tone, label, description, Icon }) => <li key={tone} className={`repair-status ${tone}`}><Icon aria-hidden="true" /><div><strong>{label}</strong><small>{description}</small></div></li>)}</ul>
    <div className="repair-legend-help"><span><Info aria-hidden="true" />Si vence el plazo, el rojo tiene prioridad aunque el trabajo esté en curso o bloqueado.</span><span><b className="repair-legend-fraction">1/3</b>1 unidad entregada de 3 solicitadas. Las franjas inferiores muestran estados mixtos.</span></div>
  </section>
}
