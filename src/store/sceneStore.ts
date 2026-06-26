import { create } from 'zustand'
import initialPlant from '../data/plant.json'
import type {
  EditMode,
  DataSources,
  AssetType,
  Criticality,
  IndustrialAsset,
  LayoutImage,
  PlantSceneDocument,
  PlantSystem,
  SnapSettings,
  ViewSettings,
} from '../types/plant'

const STORAGE_KEY = 'industrial-twin-scene-v2'

const defaultSnap: SnapSettings = { enabled: false, gridSize: 0.5, rotationDegrees: 15, scaleStep: 0.1 }
const defaultView: ViewSettings = { showLabels: true, labelMode: 'id', colorMode: 'manual' }
const finiteOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const positiveOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
const assetTypes = new Set<AssetType>(['gearbox', 'motor', 'roller', 'roller_table', 'pump', 'tank', 'conveyor', 'generic_box'])
const systems = new Set<PlantSystem>(['', 'mecanico', 'hidraulico', 'lubricacion', 'electrico', 'instrumentacion'])
const criticalities = new Set<Criticality>(['', 'A', 'B', 'C', 'D'])
const labelModes = new Set<ViewSettings['labelMode']>(['id', 'name'])
const colorModes = new Set<ViewSettings['colorMode']>(['manual', 'criticality'])

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function normalizeColor(value: unknown) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#707b86'
}

function normalizeObject(object: Partial<IndustrialAsset> | unknown): IndustrialAsset {
  const raw = (object && typeof object === 'object' ? object : {}) as Partial<IndustrialAsset>
  const existingDataSources = (raw.dataSources ?? {}) as Partial<DataSources>
  const width = positiveOr(raw.size?.width, 1)
  const height = positiveOr(raw.size?.height, 1)
  const depth = positiveOr(raw.size?.depth, 1)
  const type = assetTypes.has(raw.type as AssetType) ? raw.type as AssetType : 'generic_box'
  const system = systems.has(raw.system as PlantSystem) ? raw.system as PlantSystem : ''
  const criticality = criticalities.has(raw.criticality as Criticality) ? raw.criticality as Criticality : ''
  const dataSources = {
    plcTag: safeString(existingDataSources.plcTag),
    sapEquipmentId: safeString(existingDataSources.sapEquipmentId),
    grafanaUrl: safeString(existingDataSources.grafanaUrl),
    powerBiUrl: safeString(existingDataSources.powerBiUrl),
    documentsUrl: safeString(existingDataSources.documentsUrl),
    photosUrl: safeString(existingDataSources.photosUrl),
    failureHistory: safeString(existingDataSources.failureHistory),
  }

  return {
    id: safeString(raw.id, 'ASSET'),
    name: safeString(raw.name, safeString(raw.id, 'Activo sin nombre')),
    type,
    area: safeString(raw.area),
    system,
    position: {
      x: finiteOr(raw.position?.x, 0),
      y: positiveOr(raw.position?.y, height / 2),
      z: finiteOr(raw.position?.z, 0),
    },
    rotation: {
      x: finiteOr(raw.rotation?.x, 0),
      y: finiteOr(raw.rotation?.y, 0),
      z: finiteOr(raw.rotation?.z, 0),
    },
    size: { width, height, depth },
    color: normalizeColor(raw.color),
    criticality,
    tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => safeString(tag)).filter(Boolean) : [],
    description: safeString(raw.description),
    dataSources,
  }
}

function makeUniqueId(requested: string, existing: IndustrialAsset[], currentId?: string) {
  const base = requested.trim() || currentId || 'ASSET'
  if (!existing.some((object) => object.id === base && object.id !== currentId)) return base
  let index = 2
  let candidate = `${base}_${index}`
  while (existing.some((object) => object.id === candidate && object.id !== currentId)) {
    candidate = `${base}_${++index}`
  }
  return candidate
}

function normalizeObjects(objects: unknown[]): IndustrialAsset[] {
  return objects.reduce<IndustrialAsset[]>((normalized, object) => {
    const asset = normalizeObject(object)
    asset.id = makeUniqueId(asset.id, normalized)
    normalized.push(asset)
    return normalized
  }, [])
}

function normalizeSnap(snap?: Partial<SnapSettings>): SnapSettings {
  return {
    enabled: Boolean(snap?.enabled),
    gridSize: positiveOr(snap?.gridSize, defaultSnap.gridSize),
    rotationDegrees: positiveOr(snap?.rotationDegrees, defaultSnap.rotationDegrees),
    scaleStep: positiveOr(snap?.scaleStep, defaultSnap.scaleStep),
  }
}

function normalizeView(view?: Partial<ViewSettings>): ViewSettings {
  return {
    showLabels: view?.showLabels ?? defaultView.showLabels,
    labelMode: labelModes.has(view?.labelMode as ViewSettings['labelMode']) ? view?.labelMode as ViewSettings['labelMode'] : defaultView.labelMode,
    colorMode: colorModes.has(view?.colorMode as ViewSettings['colorMode']) ? view?.colorMode as ViewSettings['colorMode'] : defaultView.colorMode,
  }
}

function normalizeLayout(layout?: Partial<LayoutImage> | null): LayoutImage | null {
  if (!layout || typeof layout.dataUrl !== 'string' || !layout.dataUrl.startsWith('data:image/')) return null
  return {
    dataUrl: layout.dataUrl,
    fileName: safeString(layout.fileName, 'layout'),
    mimeType: safeString(layout.mimeType, 'image/*'),
    widthPx: positiveOr(layout.widthPx, 1),
    heightPx: positiveOr(layout.heightPx, 1),
    scale: positiveOr(layout.scale, 1),
    opacity: Math.min(1, Math.max(0.05, finiteOr(layout.opacity, 0.72))),
    visible: layout.visible !== false,
  }
}

const cloneInitial = () => normalizeObjects(structuredClone(initialPlant) as unknown[])

interface SceneState {
  objects: IndustrialAsset[]
  selectedObjectId: string | null
  editMode: EditMode
  layout: LayoutImage | null
  snap: SnapSettings
  view: ViewSettings
  focusRequest: { id: string; nonce: number } | null
  addObject: (object: IndustrialAsset) => void
  updateObject: (id: string, update: Partial<IndustrialAsset>) => void
  deleteObject: (id: string) => void
  duplicateObject: (id: string) => void
  selectObject: (id: string | null) => void
  setEditMode: (mode: EditMode) => void
  setLayout: (layout: LayoutImage | null) => void
  updateLayout: (update: Partial<LayoutImage>) => void
  centerLayout: () => void
  updateSnap: (update: Partial<SnapSettings>) => void
  updateView: (update: Partial<ViewSettings>) => void
  focusObject: (id: string) => void
  clearScene: () => void
  loadScene: (document: PlantSceneDocument | IndustrialAsset[]) => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => boolean
  exportScene: () => string
  importScene: (json: string) => void
}

function isObjectList(value: unknown): value is IndustrialAsset[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === 'object')
}

function isDocument(value: unknown): value is PlantSceneDocument {
  return Boolean(value) && typeof value === 'object' && isObjectList((value as PlantSceneDocument).objects)
}

export const useSceneStore = create<SceneState>((set, get) => ({
  objects: cloneInitial(),
  selectedObjectId: null,
  editMode: 'move',
  layout: null,
  snap: defaultSnap,
  view: defaultView,
  focusRequest: null,
  addObject: (object) => set((state) => {
    const normalized = normalizeObject(object)
    normalized.id = makeUniqueId(normalized.id, state.objects)
    return { objects: [...state.objects, normalized], selectedObjectId: normalized.id, focusRequest: null }
  }),
  updateObject: (id, update) => set((state) => ({
    objects: state.objects.map((object) => {
      if (object.id !== id) return object
      const normalized = normalizeObject({ ...object, ...update })
      normalized.id = makeUniqueId(normalized.id, state.objects, id)
      return normalized
    }),
    selectedObjectId: update.id && state.selectedObjectId === id ? makeUniqueId(update.id, state.objects, id) : state.selectedObjectId,
  })),
  deleteObject: (id) => set((state) => ({
    objects: state.objects.filter((object) => object.id !== id),
    selectedObjectId: state.selectedObjectId === id ? null : state.selectedObjectId,
    focusRequest: state.focusRequest?.id === id ? null : state.focusRequest,
  })),
  duplicateObject: (id) => set((state) => {
    const source = state.objects.find((object) => object.id === id)
    if (!source) return state
    let index = 1
    let nextId = `${source.id}_COPY`
    while (state.objects.some((object) => object.id === nextId)) nextId = `${source.id}_COPY_${++index}`
    const duplicate = structuredClone(source)
    duplicate.id = nextId
    duplicate.name = `${source.name || source.id} (copia)`
    duplicate.position.x += 1
    duplicate.position.z += 1
    return { objects: [...state.objects, duplicate], selectedObjectId: nextId, focusRequest: null }
  }),
  selectObject: (id) => set({ selectedObjectId: id }),
  setEditMode: (mode) => set({ editMode: mode }),
  setLayout: (layout) => set({ layout: layout ? normalizeLayout(layout) : null }),
  updateLayout: (update) => set((state) => ({ layout: state.layout ? normalizeLayout({ ...state.layout, ...update }) : null })),
  centerLayout: () => set((state) => ({ layout: state.layout ? { ...state.layout } : null })),
  updateSnap: (update) => set((state) => ({ snap: normalizeSnap({ ...state.snap, ...update }) })),
  updateView: (update) => set((state) => ({ view: normalizeView({ ...state.view, ...update }) })),
  focusObject: (id) => set({ selectedObjectId: id, focusRequest: { id, nonce: Date.now() } }),
  clearScene: () => set({ objects: [], selectedObjectId: null, focusRequest: null }),
  loadScene: (document) => {
    if (Array.isArray(document)) {
      set({ objects: normalizeObjects(document), selectedObjectId: null, focusRequest: null })
      return
    }
    set({
      objects: normalizeObjects(document.objects),
      layout: normalizeLayout(document.layout),
      snap: normalizeSnap(document.snap),
      view: normalizeView(document.view),
      selectedObjectId: null,
      focusRequest: null,
    })
  },
  saveToLocalStorage: () => localStorage.setItem(STORAGE_KEY, get().exportScene()),
  loadFromLocalStorage: () => {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('industrial-twin-scene-v1')
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    if (isObjectList(parsed)) get().loadScene(parsed)
    else if (isDocument(parsed)) get().loadScene(parsed)
    else throw new Error('El contenido guardado no es una escena valida.')
    return true
  },
  exportScene: () => {
    const state = get()
    const document: PlantSceneDocument = {
      version: 2,
      objects: state.objects,
      layout: state.layout,
      snap: state.snap,
      view: state.view,
    }
    // La imagen del layout se exporta como data URL cuando el navegador lo permite.
    // Si en el futuro se usan archivos muy pesados, conviene guardar solo metadata y pedir re-vincular el archivo.
    return JSON.stringify(document, null, 2)
  },
  importScene: (json) => {
    const parsed: unknown = JSON.parse(json)
    if (isObjectList(parsed)) get().loadScene(parsed)
    else if (isDocument(parsed)) get().loadScene(parsed)
    else throw new Error('El JSON no contiene una escena valida.')
  },
}))
