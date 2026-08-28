import { createEmptyLcoCouplingData, type CouplingInspectionEvent, type CouplingReplacementEvent, type ExtensionShaftReplacementEvent, type LcoCouplingEvent, type LcoCouplingModuleData } from '../domain/lcoCouplings'
import { normalizeLcoCouplingData } from '../data/lcoCouplingNormalizer'

export interface LcoCouplingsRepository {
  load(): Promise<LcoCouplingModuleData>
  getEvents(): Promise<LcoCouplingEvent[]>
  getAttachments(): Promise<Array<{ id: string; eventId: string; readingId?: string; fileName: string; mimeType: string; blob: Blob; caption: string; createdAt: string }>>
  saveInspection(event: CouplingInspectionEvent): Promise<void>
  updateInspection(event: CouplingInspectionEvent): Promise<void>
  deleteInspection(eventId: string): Promise<void>
  saveCouplingReplacement(event: CouplingReplacementEvent): Promise<void>
  updateCouplingReplacement(event: CouplingReplacementEvent): Promise<void>
  deleteCouplingReplacement(eventId: string): Promise<void>
  saveShaftReplacement(event: ExtensionShaftReplacementEvent): Promise<void>
  updateShaftReplacement(event: ExtensionShaftReplacementEvent): Promise<void>
  deleteShaftReplacement(eventId: string): Promise<void>
  saveConfig(data: Omit<LcoCouplingModuleData, 'events'>): Promise<void>
  replaceAll(data: LcoCouplingModuleData): Promise<void>
  clear(): Promise<void>
}

export class MemoryLcoCouplingsRepository implements LcoCouplingsRepository {
  private data = createEmptyLcoCouplingData()

  async load() { return structuredClone(this.data) }
  async getEvents() { return structuredClone(this.data.events) }
  async getAttachments() {
    return this.data.events.flatMap((event) => [
      ...event.attachments.map((photo) => memoryAttachment(photo, event.id)),
      ...(event.type === 'INSPECTION' ? event.readings.flatMap((reading) => (reading.attachments ?? []).map((photo) => memoryAttachment(photo, event.id, reading.couplingId))) : []),
    ])
  }
  async saveInspection(event: CouplingInspectionEvent) { this.upsert(event) }
  async updateInspection(event: CouplingInspectionEvent) { this.upsert(event) }
  async deleteInspection(eventId: string) { this.remove(eventId) }
  async saveCouplingReplacement(event: CouplingReplacementEvent) { this.upsert(event) }
  async updateCouplingReplacement(event: CouplingReplacementEvent) { this.upsert(event) }
  async deleteCouplingReplacement(eventId: string) { this.remove(eventId) }
  async saveShaftReplacement(event: ExtensionShaftReplacementEvent) { this.upsert(event) }
  async updateShaftReplacement(event: ExtensionShaftReplacementEvent) { this.upsert(event) }
  async deleteShaftReplacement(eventId: string) { this.remove(eventId) }
  async saveConfig(config: Omit<LcoCouplingModuleData, 'events'>) { this.data = normalizeLcoCouplingData({ ...config, events: this.data.events }) }
  async replaceAll(data: LcoCouplingModuleData) { this.data = normalizeLcoCouplingData(structuredClone(data)) }
  async clear() { this.data = createEmptyLcoCouplingData() }

  private upsert(event: LcoCouplingEvent) {
    const events = this.data.events.filter((item) => item.id !== event.id)
    this.data = normalizeLcoCouplingData({ ...this.data, events: [...events, structuredClone(event)] })
  }

  private remove(eventId: string) {
    this.data = normalizeLcoCouplingData({ ...this.data, events: this.data.events.filter((event) => event.id !== eventId) })
  }
}

function memoryAttachment(photo: LcoCouplingEvent['attachments'][number], eventId: string, readingId?: string) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(photo.dataUrl)
  const bytes = match ? Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0)) : new Uint8Array()
  return { id: photo.id, eventId, ...(readingId ? { readingId } : {}), fileName: photo.fileName, mimeType: photo.mimeType, blob: new Blob([bytes], { type: match?.[1] ?? photo.mimeType }), caption: photo.caption, createdAt: photo.createdAt }
}
