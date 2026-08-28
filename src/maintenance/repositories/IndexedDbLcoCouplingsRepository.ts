import { normalizeLcoCouplingData } from '../data/lcoCouplingNormalizer'
import { createEmptyLcoCouplingData, type CouplingInspectionEvent, type CouplingReplacementEvent, type ExtensionShaftReplacementEvent, type LcoCouplingEvent, type LcoCouplingModuleData, type LcoPhotoAttachment } from '../domain/lcoCouplings'
import type { LcoCouplingsRepository } from './LcoCouplingsRepository'

const DB_NAME = 'LACO1_MAINTENANCE'
const DB_VERSION = 1
const EVENTS = 'lcoEvents'
const ATTACHMENTS = 'lcoAttachments'
const CONFIG = 'lcoConfig'

interface StoredAttachment {
  id: string
  eventId: string
  readingId?: string
  fileName: string
  mimeType: string
  blob: Blob
  caption: string
  createdAt: string
}

export class IndexedDbLcoCouplingsRepository implements LcoCouplingsRepository {
  constructor(private readonly dbName = DB_NAME) {}

  async load(): Promise<LcoCouplingModuleData> {
    const db = await this.open()
    const transaction = db.transaction([EVENTS, ATTACHMENTS, CONFIG], 'readonly')
    const done = transactionDone(transaction)
    const eventsRequest = request<LcoCouplingEvent[]>(transaction.objectStore(EVENTS).getAll())
    const attachmentsRequest = request<StoredAttachment[]>(transaction.objectStore(ATTACHMENTS).getAll())
    const configRequest = request<Record<string, unknown> | undefined>(transaction.objectStore(CONFIG).get('module'))
    const [events, attachments, config] = await Promise.all([eventsRequest, attachmentsRequest, configRequest])
    await done
    const photos = new Map<string, LcoPhotoAttachment>()
    await Promise.all(attachments.map(async (item) => photos.set(item.id, { id: item.id, fileName: item.fileName, mimeType: item.mimeType as LcoPhotoAttachment['mimeType'], dataUrl: await blobToDataUrl(item.blob), caption: item.caption, createdAt: item.createdAt })))
    const hydrated = events.map((event) => hydrateEvent(event, attachments, photos))
    db.close()
    return normalizeLcoCouplingData({ ...createEmptyLcoCouplingData(), ...(config ?? {}), events: hydrated })
  }

  async getEvents() { return (await this.load()).events }

  async getAttachments() {
    const db = await this.open(); const transaction = db.transaction(ATTACHMENTS, 'readonly')
    const done = transactionDone(transaction); const result = await request<StoredAttachment[]>(transaction.objectStore(ATTACHMENTS).getAll()); await done; db.close(); return result
  }

  async saveInspection(event: CouplingInspectionEvent) { await this.saveEvent(event) }
  async updateInspection(event: CouplingInspectionEvent) { await this.saveEvent(event) }
  async deleteInspection(eventId: string) { await this.deleteEvent(eventId) }
  async saveCouplingReplacement(event: CouplingReplacementEvent) { await this.saveEvent(event) }
  async updateCouplingReplacement(event: CouplingReplacementEvent) { await this.saveEvent(event) }
  async deleteCouplingReplacement(eventId: string) { await this.deleteEvent(eventId) }
  async saveShaftReplacement(event: ExtensionShaftReplacementEvent) { await this.saveEvent(event) }
  async updateShaftReplacement(event: ExtensionShaftReplacementEvent) { await this.saveEvent(event) }
  async deleteShaftReplacement(eventId: string) { await this.deleteEvent(eventId) }

  async saveConfig(data: Omit<LcoCouplingModuleData, 'events'>) {
    const db = await this.open(); const transaction = db.transaction(CONFIG, 'readwrite')
    const done = transactionDone(transaction); transaction.objectStore(CONFIG).put(structuredClone(data), 'module'); await done; db.close()
  }

  async replaceAll(data: LcoCouplingModuleData) {
    const normalized = normalizeLcoCouplingData(data)
    const prepared = await Promise.all(normalized.events.map(prepareEvent))
    const db = await this.open(); const transaction = db.transaction([EVENTS, ATTACHMENTS, CONFIG], 'readwrite')
    const done = transactionDone(transaction)
    transaction.objectStore(EVENTS).clear(); transaction.objectStore(ATTACHMENTS).clear()
    for (const item of prepared) {
      transaction.objectStore(EVENTS).put(item.event)
      item.attachments.forEach((attachment) => transaction.objectStore(ATTACHMENTS).put(attachment))
    }
    const { events: _events, ...config } = normalized
    transaction.objectStore(CONFIG).put(config, 'module')
    await done; db.close()
  }

  async clear() { await this.replaceAll(createEmptyLcoCouplingData()) }

  private async saveEvent(event: LcoCouplingEvent) {
    const prepared = await prepareEvent(event)
    const db = await this.open(); const transaction = db.transaction([EVENTS, ATTACHMENTS], 'readwrite')
    const done = transactionDone(transaction)
    transaction.objectStore(EVENTS).put(prepared.event)
    await deleteAttachmentsForEvent(transaction.objectStore(ATTACHMENTS), event.id)
    prepared.attachments.forEach((attachment) => transaction.objectStore(ATTACHMENTS).put(attachment))
    await done; db.close()
  }

  private async deleteEvent(eventId: string) {
    const db = await this.open(); const transaction = db.transaction([EVENTS, ATTACHMENTS], 'readwrite')
    const done = transactionDone(transaction)
    transaction.objectStore(EVENTS).delete(eventId)
    await deleteAttachmentsForEvent(transaction.objectStore(ATTACHMENTS), eventId)
    await done; db.close()
  }

  private open() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const openRequest = indexedDB.open(this.dbName, DB_VERSION)
      openRequest.onupgradeneeded = () => {
        const db = openRequest.result
        if (!db.objectStoreNames.contains(EVENTS)) db.createObjectStore(EVENTS, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(ATTACHMENTS)) {
          const store = db.createObjectStore(ATTACHMENTS, { keyPath: 'id' })
          store.createIndex('eventId', 'eventId', { unique: false })
        }
        if (!db.objectStoreNames.contains(CONFIG)) db.createObjectStore(CONFIG)
      }
      openRequest.onsuccess = () => resolve(openRequest.result)
      openRequest.onerror = () => reject(openRequest.error ?? new Error('No se pudo abrir IndexedDB.'))
    })
  }
}

async function prepareEvent(source: LcoCouplingEvent) {
  const event = structuredClone(source)
  const attachments: StoredAttachment[] = []
  for (const photo of event.attachments) attachments.push(await storedPhoto(photo, event.id))
  event.attachments = []
  if (event.type === 'INSPECTION') {
    for (const reading of event.readings) {
      for (const photo of reading.attachments ?? []) attachments.push(await storedPhoto(photo, event.id, reading.couplingId))
      reading.attachments = []
    }
  }
  return { event, attachments }
}

async function storedPhoto(photo: LcoPhotoAttachment, eventId: string, readingId?: string): Promise<StoredAttachment> {
  return { id: photo.id, eventId, ...(readingId ? { readingId } : {}), fileName: photo.fileName, mimeType: photo.mimeType, blob: dataUrlToBlob(photo.dataUrl), caption: photo.caption, createdAt: photo.createdAt }
}

function hydrateEvent(event: LcoCouplingEvent, stored: StoredAttachment[], photos: Map<string, LcoPhotoAttachment>) {
  const result = structuredClone(event)
  result.attachments = stored.filter((item) => item.eventId === event.id && !item.readingId).flatMap((item) => photos.get(item.id) ?? [])
  if (result.type === 'INSPECTION') result.readings.forEach((reading) => { reading.attachments = stored.filter((item) => item.eventId === event.id && item.readingId === reading.couplingId).flatMap((item) => photos.get(item.id) ?? []) })
  return result
}

function dataUrlToBlob(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)
  if (!match) return new Blob([], { type: 'application/octet-stream' })
  const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0))
  return new Blob([bytes], { type: match[1] })
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob) })
}

function deleteAttachmentsForEvent(store: IDBObjectStore, eventId: string) {
  return new Promise<void>((resolve, reject) => {
    const cursor = store.index('eventId').openKeyCursor(IDBKeyRange.only(eventId))
    cursor.onsuccess = () => { const item = cursor.result; if (!item) { resolve(); return }; store.delete(item.primaryKey); item.continue() }
    cursor.onerror = () => reject(cursor.error)
  })
}

function request<T>(value: IDBRequest<T>) { return new Promise<T>((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error) }) }
function transactionDone(transaction: IDBTransaction) { return new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error ?? new Error('Transacción IndexedDB cancelada.')) }) }
