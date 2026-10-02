import { CirclePlus, Play, Pause, Truck, Check, AlertTriangle, FileText } from 'lucide-react'
import { REPAIR_LOCALE, REPAIR_TIME_ZONE, formatRepairDate } from './calendar'
import { eventPresentation } from './presentation'
import type { RepairEvent, RepairState } from './types'
import './repairTimeline.css'

const treatments = {
  CREATE: { tone: 'created', Icon: CirclePlus }, IMPORT: { tone: 'created', Icon: CirclePlus },
  START: { tone: 'progress', Icon: Play }, BLOCK: { tone: 'blocked', Icon: Pause },
  SENT: { tone: 'delivered', Icon: Truck }, DELIVER: { tone: 'delivered', Icon: Check }, RESOLVE: { tone: 'delivered', Icon: Check },
  CANCEL: { tone: 'late', Icon: AlertTriangle }, OVERDUE: { tone: 'late', Icon: AlertTriangle },
} as const

/** Predecessors follow the immutable audit sequence, not the display order. */
export function timelineEntries(events: RepairEvent[]) {
  const previous = new Map<string, RepairEvent>()
  const entries = [...events].sort((a, b) => a.revision - b.revision || a.id - b.id).map((event) => {
    const presentation = eventPresentation(event, previous.get(event.requestId))
    previous.set(event.requestId, event)
    const transitions = presentation.lines.filter((line) => line.startsWith('Unidad #'))
    const units = presentation.lines.find((line) => line.startsWith('Unidades:'))
    let summary: string[]
    if (event.action === 'EDIT' && Array.isArray(event.detail.changes)) summary = [`${event.detail.changes.length} cambios`]
    else if (['CREATE', 'IMPORT', 'EDIT'].includes(event.action)) summary = presentation.lines.filter((line) => /^(Cantidad:|Criticidad:|Necesidad Planta:|Taller:)/.test(line))
    else if (event.action === 'BLOCK') summary = [...(transitions.length ? transitions : units ? [units] : []), ...presentation.lines.filter((line) => /^(Responsable:|Motivo:)/.test(line))]
    else if (event.action === 'SENT') summary = [...(units ? [units] : []), ...(typeof event.detail.date === 'string' ? [`Fecha envío: ${formatRepairDate(event.detail.date)}`] : [])]
    else summary = [...transitions, ...presentation.lines.filter((line) => !transitions.includes(line) && !(transitions.length && line === units))].slice(0, 3)
    const freeText = String(event.detail.comment || event.detail.description || (['CREATE', 'IMPORT', 'EDIT'].includes(event.action) ? event.snapshot.notes : '') || '')
    return { event, ...presentation, summary: summary.join(' · '), excerpt: freeText && !summary.includes(freeText) ? freeText : '' }
  })
  return entries.sort((a, b) => Date.parse(b.event.recordedAt) - Date.parse(a.event.recordedAt) || b.event.id - a.event.id)
}

export function RepairTimeline({ events, users }: { events: RepairEvent[]; users: RepairState['users'] }) {
  const entries = timelineEntries(events)
  return <ol className="repair-event-timeline" aria-label="Historial de reparación, más reciente primero">
    {entries.map(({ event, title, lines, summary, excerpt }) => {
      const { tone, Icon } = treatments[event.action as keyof typeof treatments] || { tone: 'neutral', Icon: FileText }
      const user = users.find((u) => u.id === event.actor)?.name || (event.actor === 'local-user' ? 'Usuario local' : 'Usuario registrado')
      const time = new Date(event.recordedAt).toLocaleString(REPAIR_LOCALE, { timeZone: REPAIR_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      return <li key={event.id} className={`repair-event repair-event-${tone}`}>
        <span className="repair-event-marker" aria-hidden="true"><Icon size={16} /></span>
        <article className="repair-event-body"><h4>{title}</h4>
          <div className="repair-event-meta"><time dateTime={event.recordedAt}>{time}</time><span>· {user}</span></div>
          {summary && <p className="repair-event-summary">{summary}</p>}
          {excerpt && <p className="repair-event-excerpt">{excerpt}</p>}
          <details className="repair-event-details"><summary><span className="event-show">Ver detalle</span><span className="event-hide">Ocultar detalle</span></summary>
            <div className="repair-event-full">{lines.map((line, index) => <p key={index}>{line}</p>)}
              <dl><dt>Fecha de registro</dt><dd>{new Date(event.recordedAt).toLocaleString(REPAIR_LOCALE, { timeZone: REPAIR_TIME_ZONE })}</dd><dt>Usuario</dt><dd>{user}</dd><dt>ID de usuario</dt><dd>{event.actor}</dd><dt>Evento / revisión</dt><dd>{event.id} / {event.revision}</dd></dl>
              <details><summary>Datos completos del registro</summary><pre>{JSON.stringify({ id: event.id, requestId: event.requestId, action: event.action, actor: event.actor, recordedAt: event.recordedAt, revision: event.revision, detail: event.detail, snapshot: event.snapshot }, null, 2)}</pre></details>
            </div>
          </details>
        </article>
      </li>
    })}
  </ol>
}
