import { useMemo, useState } from 'react'
import type { IndustrialAsset } from '../../types/plant'
import { getEquipmentForAsset, getEventsForSubassembly, getSubassembliesForEquipment } from '../domain/maintenanceSelectors'
import { useMaintenanceStore } from '../store/maintenanceStore'
import { ReplacementDetail } from './ReplacementDetail'
import { ReplacementList } from './ReplacementList'
import { eventLabels } from './ReplacementEventForm'

export function MaintenancePanel({ asset, timelineOnly = false }: { asset: IndustrialAsset; timelineOnly?: boolean }) {
  const store = useMaintenanceStore(); const [filter, setFilter] = useState<'ALL' | 'REPLACEMENT' | 'CORRECTIVE' | 'PREVENTIVE' | 'INSPECTION'>('ALL'); const equipment = getEquipmentForAsset(store, asset.id); const positions = equipment ? getSubassembliesForEquipment(store, equipment.id) : []
  const timeline = useMemo(() => positions.flatMap((position) => getEventsForSubassembly(store, position.id).map((event) => ({ event, position }))).sort((a, b) => b.event.date.localeCompare(a.event.date) || b.event.createdAt.localeCompare(a.event.createdAt)), [store.events, positions.map((item) => item.id).join('|')])
  const filtered = timeline.filter(({ event }) => filter === 'ALL' || event.type === filter || (filter === 'CORRECTIVE' && (event.type === 'FAILURE' || event.type === 'REPAIR')) || (filter === 'PREVENTIVE' && ['LUBRICATION', 'ADJUSTMENT', 'OVERHAUL'].includes(event.type)))
  if (timelineOnly) return <><div className="maintenance-timeline-filters">{(['ALL', 'REPLACEMENT', 'CORRECTIVE', 'PREVENTIVE', 'INSPECTION'] as const).map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>{filtered.length ? <div className="maintenance-timeline">{filtered.map(({ event, position }) => <article key={event.id}><time>{event.date}</time><div><span className="maintenance-chip">{eventLabels[event.type]}</span><strong>{position.name}</strong><p>{event.notes || 'Sin notas'}{event.workOrder ? ` · OT ${event.workOrder}` : ''}</p></div></article>)}</div> : <p className="maintenance-empty">No hay eventos registrados.</p>}</>
  return <><ReplacementList asset={asset} />{store.drawerOpen && store.selectedSubassemblyId && <ReplacementDetail id={store.selectedSubassemblyId} />}</>
}
