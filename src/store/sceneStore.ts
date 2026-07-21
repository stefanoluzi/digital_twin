import { create } from 'zustand'
import initialPlant from '../data/plant.json'
import { AREA_FILTER_ALL, normalizeAreaCode, type AreaFilter } from '../config/areas'
import { normalizeParamsForType, sizeFromParams } from '../utils/assetParams'
import type {
  EditMode,
  DataSources,
  AssetType,
  Criticality,
  IndustrialAsset,
  PlantSceneDocument,
  PlantSystem,
  ReferenceLayout,
  SnapSettings,
  ViewSettings,
  CameraViewMode,
} from '../types/plant'
import { assetTypes as allAssetTypes } from '../types/plant'

const STORAGE_KEY = 'industrial-twin-scene-v2'
const THEME_KEY = 'industrial-twin-theme'

const defaultSnap: SnapSettings = { enabled: false, gridSize: 0.5, rotationDegrees: 15, scaleStep: 0.1 }
const storedTheme = typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
const defaultView: ViewSettings = { showLabels: true, showResizeHandles: true, labelMode: 'id', colorMode: 'manual', areaFilter: AREA_FILTER_ALL, editLayout: false, theme: storedTheme }
const finiteOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const positiveOr = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
const clampScale = (value: unknown, fallback = 1) => Math.min(1000, Math.max(0.01, positiveOr(value, fallback)))
const normalizeRadians = (value: unknown, fallback = 0) => {
  const radians = finiteOr(value, fallback)
  const fullTurn = Math.PI * 2
  return ((radians + Math.PI) % fullTurn + fullTurn) % fullTurn - Math.PI
}
const assetTypes = new Set<AssetType>(allAssetTypes)
const systems = new Set<PlantSystem>(['', 'mecanico', 'hidraulico', 'lubricacion', 'electrico', 'instrumentacion'])
const criticalities = new Set<Criticality>(['', 'A', 'B', 'C', 'D'])
const labelModes = new Set<ViewSettings['labelMode']>(['id', 'name', 'area'])
const colorModes = new Set<ViewSettings['colorMode']>(['manual', 'criticality', 'area'])
const themeModes = new Set<ViewSettings['theme']>(['dark', 'light'])

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function normalizeColor(value: unknown) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#707b86'
}

function migrateAssetType(type: unknown): AssetType {
  if (type === 'chain_bed_single') return 'chain_bed'
  if (type === 'chain_bed_double') return 'chain_bed'
  if (type === 'chain_bed_five' || type === 'chain_bed_5_rows') return 'chain_bed'
  return assetTypes.has(type as AssetType) ? type as AssetType : 'generic_box'
}

function migrateParams(type: unknown, params: IndustrialAsset['params'] | undefined): IndustrialAsset['params'] {
  if (type === 'chain_bed_single') return { ...params, chainCount: 1 }
  if (type === 'chain_bed_double') return { ...params, chainCount: 2 }
  if (type === 'chain_bed_five' || type === 'chain_bed_5_rows') return { ...params, chainCount: 5 }
  const legacyParams = params as (IndustrialAsset['params'] & { chainRows?: unknown }) | undefined
  if (type === 'chain_bed' && typeof params?.chainCount !== 'number' && typeof legacyParams?.chainRows === 'number') return { ...params, chainCount: legacyParams.chainRows }
  return params ?? {}
}

function normalizeObject(object: Partial<IndustrialAsset> | unknown): IndustrialAsset {
  const raw = (object && typeof object === 'object' ? object : {}) as Partial<IndustrialAsset>
  const existingDataSources = (raw.dataSources ?? {}) as Partial<DataSources>
  const type = migrateAssetType(raw.type)
  const hasSize = Boolean(raw.size && typeof raw.size === 'object')
  const baseSize = {
    width: positiveOr(raw.size?.width, 1),
    height: positiveOr(raw.size?.height, 1),
    depth: positiveOr(raw.size?.depth, 1),
  }
  const params = normalizeParamsForType(type, migrateParams(raw.type, raw.params))
  const size = hasSize ? baseSize : sizeFromParams(type, params, baseSize)
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
    areaCode: normalizeAreaCode(raw.areaCode),
    system,
    position: {
      x: finiteOr(raw.position?.x, 0),
      y: positiveOr(raw.position?.y, size.height / 2),
      z: finiteOr(raw.position?.z, 0),
    },
    rotation: {
      x: normalizeRadians(raw.rotation?.x),
      y: normalizeRadians(raw.rotation?.y),
      z: normalizeRadians(raw.rotation?.z),
    },
    size,
    params,
    color: normalizeColor(raw.color),
    criticality,
    locked: Boolean(raw.locked),
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
    showResizeHandles: view?.showResizeHandles ?? defaultView.showResizeHandles,
    labelMode: labelModes.has(view?.labelMode as ViewSettings['labelMode']) ? view?.labelMode as ViewSettings['labelMode'] : defaultView.labelMode,
    colorMode: colorModes.has(view?.colorMode as ViewSettings['colorMode']) ? view?.colorMode as ViewSettings['colorMode'] : defaultView.colorMode,
    areaFilter: view?.areaFilter === AREA_FILTER_ALL ? AREA_FILTER_ALL : normalizeAreaCode(view?.areaFilter),
    editLayout: Boolean(view?.editLayout),
    theme: themeModes.has(view?.theme as ViewSettings['theme']) ? view?.theme as ViewSettings['theme'] : defaultView.theme,
  }
}

function normalizeLayout(layout?: Partial<ReferenceLayout> | null): ReferenceLayout | null {
  if (!layout) return null
  const legacy = layout as Partial<ReferenceLayout> & {
    dataUrl?: unknown
    scale?: number | { x?: unknown; y?: unknown }
    stretchX?: unknown
    stretchY?: unknown
  }
  const textureDataUrl = typeof layout.textureDataUrl === 'string'
    ? layout.textureDataUrl
    : typeof legacy.dataUrl === 'string' ? legacy.dataUrl : undefined
  const naturalWidth = positiveOr(layout.naturalWidth, positiveOr(layout.widthPx, 1))
  const naturalHeight = positiveOr(layout.naturalHeight, positiveOr(layout.heightPx, 1))
  const aspectRatio = positiveOr(layout.aspectRatio, naturalWidth / naturalHeight)
  const baseWidth = positiveOr(layout.baseWidth, 20)
  const baseHeight = positiveOr(layout.baseHeight, baseWidth / Math.max(0.0001, aspectRatio))
  const legacyScale = typeof legacy.scale === 'number' ? legacy.scale : undefined
  const legacyScaleX = typeof legacy.scale === 'object' && legacy.scale ? legacy.scale.x : legacyScale
  const legacyScaleY = typeof legacy.scale === 'object' && legacy.scale ? legacy.scale.y : legacyScale
  const lockAspectRatio = layout.lockAspectRatio !== false
  const legacyScaleXFallback = typeof legacyScaleX === 'number' ? legacyScaleX : 1
  const legacyScaleYFallback = typeof legacyScaleY === 'number' ? legacyScaleY : 1
  const uniformScale = clampScale(layout.uniformScale, lockAspectRatio ? legacyScaleXFallback : 1)
  const stretchWidth = lockAspectRatio ? 1 : clampScale(layout.stretchWidth ?? legacy.stretchX, legacyScaleXFallback)
  const stretchHeight = lockAspectRatio ? 1 : clampScale(layout.stretchHeight ?? legacy.stretchY, legacyScaleYFallback)
  const calibration = layout.calibration && typeof layout.calibration === 'object' ? layout.calibration : undefined
  const pointA = calibration?.pointA
  const pointB = calibration?.pointB
  const normalizePoint = (point: typeof pointA) => point && typeof point.u === 'number' && typeof point.v === 'number'
    ? { u: Math.min(1, Math.max(0, point.u)), v: Math.min(1, Math.max(0, point.v)) }
    : undefined
  const crop = layout.crop && typeof layout.crop === 'object' ? layout.crop : undefined
  const uMin = Math.min(1, Math.max(0, finiteOr(crop?.uMin, 0)))
  const vMin = Math.min(1, Math.max(0, finiteOr(crop?.vMin, 0)))
  const uMax = Math.min(1, Math.max(0, finiteOr(crop?.uMax, 1)))
  const vMax = Math.min(1, Math.max(0, finiteOr(crop?.vMax, 1)))
  return {
    textureDataUrl,
    layoutPath: safeString(layout.layoutPath, safeString(layout.fileName, 'reference-layout')),
    fileName: safeString(layout.fileName, 'layout'),
    mimeType: safeString(layout.mimeType, 'image/*'),
    widthPx: positiveOr(layout.widthPx, 1),
    heightPx: positiveOr(layout.heightPx, 1),
    naturalWidth,
    naturalHeight,
    aspectRatio,
    baseWidth,
    baseHeight,
    uniformScale,
    stretchWidth,
    stretchHeight,
    position: {
      x: finiteOr(layout.position?.x, 0),
      y: Math.max(0.028, finiteOr(layout.position?.y, 0.035)),
      z: finiteOr(layout.position?.z, 0),
    },
    rotation: {
      x: normalizeRadians(layout.rotation?.x),
      y: normalizeRadians(layout.rotation?.y),
      z: normalizeRadians(layout.rotation?.z),
    },
    opacity: Math.min(1, Math.max(0, finiteOr(layout.opacity, 0.4))),
    visible: layout.visible !== false,
    locked: Boolean(layout.locked),
    lockAspectRatio,
    calibration: {
      pointA: normalizePoint(pointA),
      pointB: normalizePoint(pointB),
      realDistance: positiveOr(calibration?.realDistance, 0),
      calibrated: Boolean(calibration?.calibrated),
    },
    crop: {
      enabled: Boolean(crop?.enabled),
      uMin: Math.min(uMin, uMax - 0.01),
      vMin: Math.min(vMin, vMax - 0.01),
      uMax: Math.max(uMax, uMin + 0.01),
      vMax: Math.max(vMax, vMin + 0.01),
    },
    missing: Boolean(layout.missing) || !textureDataUrl,
  }
}

function serializeLayout(layout: ReferenceLayout | null, includeTexture: boolean): ReferenceLayout | null {
  if (!layout) return null
  return {
    ...layout,
    textureDataUrl: includeTexture ? layout.textureDataUrl : undefined,
    missing: includeTexture ? layout.missing : !layout.textureDataUrl,
  }
}

const cloneInitial = () => normalizeObjects(structuredClone(initialPlant) as unknown[])

interface SceneState {
  objects: IndustrialAsset[]
  selectedObjectId: string | null
  selectedObjectIds: string[]
  primarySelectedObjectId: string | null
  editMode: EditMode
  referenceLayout: ReferenceLayout | null
  snap: SnapSettings
  view: ViewSettings
  focusRequest: { id: string; nonce: number } | null
  focusAreaRequest: { areaFilter: AreaFilter; nonce: number } | null
  cameraViewRequest: { mode: CameraViewMode; nonce: number } | null
  layoutCalibration: { active: boolean; pointA?: ReferenceLayout['calibration']['pointA']; pointB?: ReferenceLayout['calibration']['pointB'] }
  layoutCrop: { active: boolean; draft?: ReferenceLayout['crop'] }
  addObject: (object: IndustrialAsset) => void
  updateObject: (id: string, update: Partial<IndustrialAsset>) => void
  deleteObject: (id: string) => void
  deleteObjects: (ids: string[]) => void
  duplicateObject: (id: string) => void
  selectObject: (id: string | null) => void
  toggleObjectSelection: (id: string) => void
  clearSelection: () => void
  setEditMode: (mode: EditMode) => void
  setLayout: (layout: ReferenceLayout | null) => void
  updateLayout: (update: Partial<ReferenceLayout>) => void
  centerLayout: () => void
  startLayoutCalibration: () => void
  cancelLayoutCalibration: () => void
  setLayoutCalibrationDraft: (draft: { pointA?: ReferenceLayout['calibration']['pointA']; pointB?: ReferenceLayout['calibration']['pointB'] }) => void
  clearLayoutCalibration: () => void
  startLayoutCrop: () => void
  cancelLayoutCrop: () => void
  updateLayoutCropDraft: (crop: ReferenceLayout['crop']) => void
  applyLayoutCrop: () => void
  resetLayoutCrop: () => void
  updateSnap: (update: Partial<SnapSettings>) => void
  updateView: (update: Partial<ViewSettings>) => void
  focusObject: (id: string) => void
  focusArea: () => void
  requestCameraView: (mode: CameraViewMode) => void
  clearScene: () => void
  loadScene: (document: PlantSceneDocument | IndustrialAsset[]) => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => boolean
  exportScene: (options?: { includeReferenceTexture?: boolean }) => string
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
  selectedObjectIds: [],
  primarySelectedObjectId: null,
  editMode: 'move',
  referenceLayout: null,
  snap: defaultSnap,
  view: defaultView,
  focusRequest: null,
  focusAreaRequest: null,
  cameraViewRequest: null,
  layoutCalibration: { active: false },
  layoutCrop: { active: false },
  addObject: (object) => set((state) => {
    const normalized = normalizeObject(object)
    normalized.id = makeUniqueId(normalized.id, state.objects)
    return {
      objects: [...state.objects, normalized],
      selectedObjectId: normalized.id,
      selectedObjectIds: [normalized.id],
      primarySelectedObjectId: normalized.id,
      focusRequest: null,
      focusAreaRequest: null,
    }
  }),
  updateObject: (id, update) => set((state) => ({
    objects: state.objects.map((object) => {
      if (object.id !== id) return object
      const normalized = normalizeObject({ ...object, ...update })
      normalized.id = makeUniqueId(normalized.id, state.objects, id)
      return normalized
    }),
    selectedObjectId: update.id && state.selectedObjectId === id ? makeUniqueId(update.id, state.objects, id) : state.selectedObjectId,
    primarySelectedObjectId: update.id && state.primarySelectedObjectId === id ? makeUniqueId(update.id, state.objects, id) : state.primarySelectedObjectId,
    selectedObjectIds: update.id ? state.selectedObjectIds.map((selectedId) => selectedId === id ? makeUniqueId(update.id ?? id, state.objects, id) : selectedId) : state.selectedObjectIds,
  })),
  deleteObject: (id) => set((state) => {
    const selectedObjectIds = state.selectedObjectIds.filter((selectedId) => selectedId !== id)
    const primarySelectedObjectId = state.primarySelectedObjectId === id ? selectedObjectIds[0] ?? null : state.primarySelectedObjectId
    return {
      objects: state.objects.filter((object) => object.id !== id),
      selectedObjectId: primarySelectedObjectId,
      selectedObjectIds,
      primarySelectedObjectId,
      focusRequest: state.focusRequest?.id === id ? null : state.focusRequest,
      focusAreaRequest: state.focusAreaRequest,
    }
  }),
  deleteObjects: (ids) => set((state) => {
    const targets = new Set(ids)
    const selectedObjectIds = state.selectedObjectIds.filter((id) => !targets.has(id))
    const primarySelectedObjectId = state.primarySelectedObjectId && !targets.has(state.primarySelectedObjectId)
      ? state.primarySelectedObjectId
      : selectedObjectIds[0] ?? null
    return {
      objects: state.objects.filter((object) => !targets.has(object.id)),
      selectedObjectIds,
      primarySelectedObjectId,
      selectedObjectId: primarySelectedObjectId,
      focusRequest: state.focusRequest && targets.has(state.focusRequest.id) ? null : state.focusRequest,
      focusAreaRequest: state.focusAreaRequest,
    }
  }),
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
    return {
      objects: [...state.objects, duplicate],
      selectedObjectId: nextId,
      selectedObjectIds: [nextId],
      primarySelectedObjectId: nextId,
      focusRequest: null,
      focusAreaRequest: null,
    }
  }),
  selectObject: (id) => set({
    selectedObjectId: id,
    selectedObjectIds: id ? [id] : [],
    primarySelectedObjectId: id,
  }),
  toggleObjectSelection: (id) => set((state) => {
    const exists = state.selectedObjectIds.includes(id)
    const selectedObjectIds = exists
      ? state.selectedObjectIds.filter((selectedId) => selectedId !== id)
      : [...state.selectedObjectIds, id]
    const primarySelectedObjectId = exists
      ? (state.primarySelectedObjectId === id ? selectedObjectIds[selectedObjectIds.length - 1] ?? null : state.primarySelectedObjectId)
      : id
    return {
      selectedObjectIds,
      primarySelectedObjectId,
      selectedObjectId: primarySelectedObjectId,
    }
  }),
  clearSelection: () => set({ selectedObjectId: null, selectedObjectIds: [], primarySelectedObjectId: null }),
  setEditMode: (mode) => set({ editMode: mode }),
  setLayout: (layout) => set({ referenceLayout: layout ? normalizeLayout(layout) : null }),
  updateLayout: (update) => set((state) => ({ referenceLayout: state.referenceLayout ? normalizeLayout({ ...state.referenceLayout, ...update }) : null })),
  centerLayout: () => set((state) => ({ referenceLayout: state.referenceLayout ? { ...state.referenceLayout, position: { x: 0, y: 0.035, z: 0 }, rotation: { x: 0, y: 0, z: 0 } } : null })),
  startLayoutCalibration: () => set({ layoutCalibration: { active: true }, selectedObjectId: null, selectedObjectIds: [], primarySelectedObjectId: null }),
  cancelLayoutCalibration: () => set({ layoutCalibration: { active: false, pointA: undefined, pointB: undefined } }),
  setLayoutCalibrationDraft: (draft) => set((state) => ({ layoutCalibration: { active: state.layoutCalibration.active, ...draft } })),
  clearLayoutCalibration: () => set((state) => ({
    referenceLayout: state.referenceLayout ? normalizeLayout({ ...state.referenceLayout, calibration: { calibrated: false } }) : null,
    layoutCalibration: { active: false },
  })),
  startLayoutCrop: () => set((state) => ({
    layoutCrop: {
      active: true,
      draft: state.referenceLayout?.crop.enabled
        ? { ...state.referenceLayout.crop }
        : { enabled: true, uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
    },
    layoutCalibration: { active: false },
    selectedObjectId: null,
    selectedObjectIds: [],
    primarySelectedObjectId: null,
  })),
  cancelLayoutCrop: () => set({ layoutCrop: { active: false } }),
  updateLayoutCropDraft: (crop) => set({ layoutCrop: { active: true, draft: normalizeLayout({ crop } as Partial<ReferenceLayout>)?.crop ?? crop } }),
  applyLayoutCrop: () => set((state) => ({
    referenceLayout: state.referenceLayout ? normalizeLayout({ ...state.referenceLayout, crop: { ...(state.layoutCrop.draft ?? state.referenceLayout.crop), enabled: true } }) : null,
    layoutCrop: { active: false },
  })),
  resetLayoutCrop: () => set((state) => ({
    referenceLayout: state.layoutCrop.active
      ? state.referenceLayout
      : state.referenceLayout
        ? normalizeLayout({ ...state.referenceLayout, crop: { enabled: false, uMin: 0, vMin: 0, uMax: 1, vMax: 1 } })
        : null,
    layoutCrop: state.layoutCrop.active
      ? { active: true, draft: { enabled: true, uMin: 0, vMin: 0, uMax: 1, vMax: 1 } }
      : { active: false },
  })),
  updateSnap: (update) => set((state) => ({ snap: normalizeSnap({ ...state.snap, ...update }) })),
  updateView: (update) => set((state) => {
    const view = normalizeView({ ...state.view, ...update })
    const visible = (object: IndustrialAsset) => view.areaFilter === AREA_FILTER_ALL || object.areaCode === view.areaFilter
    const selectedObjectIds = state.selectedObjectIds.filter((id) => state.objects.some((object) => object.id === id && visible(object)))
    const primarySelectedObjectId = selectedObjectIds.includes(state.primarySelectedObjectId ?? '') ? state.primarySelectedObjectId : selectedObjectIds[0] ?? null
    localStorage.setItem(THEME_KEY, view.theme)
    return { view, selectedObjectIds, primarySelectedObjectId, selectedObjectId: primarySelectedObjectId }
  }),
  focusObject: (id) => set({ selectedObjectId: id, selectedObjectIds: [id], primarySelectedObjectId: id, focusRequest: { id, nonce: Date.now() } }),
  focusArea: () => set((state) => ({ focusAreaRequest: { areaFilter: state.view.areaFilter, nonce: Date.now() } })),
  requestCameraView: (mode) => set({ cameraViewRequest: { mode, nonce: Date.now() } }),
  clearScene: () => set({ objects: [], selectedObjectId: null, selectedObjectIds: [], primarySelectedObjectId: null, focusRequest: null, focusAreaRequest: null, cameraViewRequest: null }),
  loadScene: (document) => {
    if (Array.isArray(document)) {
      set({ objects: normalizeObjects(document), selectedObjectId: null, selectedObjectIds: [], primarySelectedObjectId: null, focusRequest: null, focusAreaRequest: null, cameraViewRequest: null })
      return
    }
    set({
      objects: normalizeObjects(document.objects),
      referenceLayout: normalizeLayout(document.referenceLayout ?? document.layout),
      snap: normalizeSnap(document.snap),
      view: normalizeView(document.view),
      selectedObjectId: null,
      selectedObjectIds: [],
      primarySelectedObjectId: null,
      focusRequest: null,
      focusAreaRequest: null,
      cameraViewRequest: null,
    })
  },
  saveToLocalStorage: () => localStorage.setItem(STORAGE_KEY, get().exportScene({ includeReferenceTexture: true })),
  loadFromLocalStorage: () => {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem('industrial-twin-scene-v1')
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    if (isObjectList(parsed)) get().loadScene(parsed)
    else if (isDocument(parsed)) get().loadScene(parsed)
    else throw new Error('El contenido guardado no es una escena valida.')
    return true
  },
  exportScene: (options) => {
    const state = get()
    const document: PlantSceneDocument = {
      version: 2,
      objects: state.objects,
      referenceLayout: serializeLayout(state.referenceLayout, Boolean(options?.includeReferenceTexture)),
      snap: state.snap,
      view: state.view,
    }
    return JSON.stringify(document, null, 2)
  },
  importScene: (json) => {
    const parsed: unknown = JSON.parse(json)
    if (isObjectList(parsed)) get().loadScene(parsed)
    else if (isDocument(parsed)) get().loadScene(parsed)
    else throw new Error('El JSON no contiene una escena valida.')
  },
}))
