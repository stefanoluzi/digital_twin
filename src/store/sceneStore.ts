import { create } from 'zustand'
import initialPlant from '../data/plant.json'
import { AREA_FILTER_ALL, normalizeAreaCode, type AreaFilter } from '../config/areas'
import { PLANT_FRONT_DIRECTION, type CameraPresetId, type PlantFrontDirection } from '../config/cameraPresets'
import {
  DEFAULT_ACTIVE_LEVEL,
  DEFAULT_PLANT_LEVELS,
  DEFAULT_VISIBLE_LEVEL_FILTER,
  LEVEL_0,
  LEVEL_1,
  MULTI_LEVEL,
  getLevelElevation,
  isLevelVisible,
  normalizeInsertionLevel,
  normalizeLevelCode,
  normalizePlantLevels,
  normalizeVisibleLevelFilter,
  type InsertionLevelCode,
  type PlantLevelCode,
  type PlantLevelDefinition,
  type VisibleLevelFilter,
} from '../config/plantLevels'
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
  RotationAxis,
  AlignmentAxis,
  AlignmentMode,
  Vector3Data,
} from '../types/plant'
import { assetTypes as allAssetTypes } from '../types/plant'
import { applyUniformScale, clampUniformScale } from '../utils/uniformScale'
import { getObjectWorldBounds } from '../services/objectBoundsService'
import { getCurrentInsertionPoint } from '../services/viewportInsertionService'

const STORAGE_KEY = 'industrial-twin-scene-v2'
const THEME_KEY = 'industrial-twin-theme'
const MAX_HISTORY = 100
const HISTORY_COALESCE_MS = 450

const defaultSnap: SnapSettings = { enabled: false, gridSize: 0.5, rotationSnapEnabled: true, rotationSnapAngle: 90, scaleStep: 0.1 }
const storedTheme = typeof localStorage !== 'undefined' && localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
const defaultView: ViewSettings = { showLabels: true, showResizeHandles: true, labelMode: 'id', colorMode: 'manual', areaFilter: AREA_FILTER_ALL, editLayout: false, theme: storedTheme, plantFrontDirection: PLANT_FRONT_DIRECTION, activeCameraPreset: 'ISO_FRONT' }
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
const plantFrontDirections = new Set<PlantFrontDirection>(['POSITIVE_X', 'NEGATIVE_X', 'POSITIVE_Z', 'NEGATIVE_Z'])
const cameraPresetIds = new Set<CameraPresetId>(['TOP', 'FRONT', 'BACK', 'LEFT', 'RIGHT', 'ISO_FRONT', 'ISO_BACK', 'ISO_LEFT', 'ISO_RIGHT'])
const cameraPresetForViewMode: Partial<Record<CameraViewMode, CameraPresetId>> = {
  front: 'FRONT',
  back: 'BACK',
  left: 'LEFT',
  right: 'RIGHT',
  isometric: 'ISO_FRONT',
  isometric_back: 'ISO_BACK',
  top: 'TOP',
}

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
  const size = type === 'hollow_cylinder' || !hasSize ? sizeFromParams(type, params, baseSize) : baseSize
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
    levelCode: normalizeLevelCode(raw.levelCode),
    system,
    position: {
      x: finiteOr(raw.position?.x, 0),
      y: finiteOr(raw.position?.y, size.height / 2),
      z: finiteOr(raw.position?.z, 0),
    },
    rotation: {
      x: normalizeRadians(raw.rotation?.x),
      y: normalizeRadians(raw.rotation?.y),
      z: normalizeRadians(raw.rotation?.z),
    },
    size,
    uniformScale: clampUniformScale(raw.uniformScale),
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
  const legacy = snap as (Partial<SnapSettings> & { rotationDegrees?: number }) | undefined
  return {
    enabled: Boolean(snap?.enabled),
    gridSize: positiveOr(snap?.gridSize, defaultSnap.gridSize),
    rotationSnapEnabled: snap?.rotationSnapEnabled ?? (legacy?.rotationDegrees !== undefined ? Boolean(snap?.enabled) : defaultSnap.rotationSnapEnabled),
    rotationSnapAngle: positiveOr(snap?.rotationSnapAngle, positiveOr(legacy?.rotationDegrees, defaultSnap.rotationSnapAngle)),
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
    plantFrontDirection: plantFrontDirections.has(view?.plantFrontDirection as PlantFrontDirection) ? view?.plantFrontDirection as PlantFrontDirection : defaultView.plantFrontDirection,
    activeCameraPreset: cameraPresetIds.has(view?.activeCameraPreset as CameraPresetId) ? view?.activeCameraPreset as CameraPresetId : defaultView.activeCameraPreset,
  }
}

function normalizeLayout(layout?: Partial<ReferenceLayout> | null, legacyLevelElevation = 0): ReferenceLayout | null {
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
  const sourceDataUrl = typeof layout.sourceDataUrl === 'string' ? layout.sourceDataUrl : textureDataUrl
  const sourceType = layout.sourceType === 'pdf' || layout.mimeType === 'application/pdf' ? 'pdf' : 'image'
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
  const levelCode = layout.levelCode === LEVEL_0 ? LEVEL_0 : LEVEL_1
  const rawPositionY = finiteOr(layout.position?.y, 0.035)
  const positionY = layout.positionMode === 'level-relative' || legacyLevelElevation === 0 || rawPositionY < legacyLevelElevation - 0.5
    ? rawPositionY
    : rawPositionY - legacyLevelElevation
  return {
    levelCode,
    positionMode: 'level-relative',
    textureDataUrl,
    sourceDataUrl,
    sourceType,
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
      y: positionY,
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

interface HistorySnapshot {
  objects: IndustrialAsset[]
  plantLevels: PlantLevelDefinition[]
  selectedObjectId: string | null
  selectedObjectIds: string[]
  primarySelectedObjectId: string | null
}

export interface HistoryEntry {
  id: string
  label: string
  timestamp: number
  coalesceKey?: string
  before: HistorySnapshot
  after: HistorySnapshot
}

interface ClipboardState {
  objects: IndustrialAsset[]
  center: Vector3Data
  pasteCount: number
}

interface ScaleSelectionResult {
  scaled: number
  locked: number
  missing: number
}

const cloneObjects = (objects: IndustrialAsset[]) => structuredClone(objects)
const snapshotsEqual = (left: HistorySnapshot, right: HistorySnapshot) => JSON.stringify([left.objects, left.plantLevels]) === JSON.stringify([right.objects, right.plantLevels])

function copyIdFor(sourceId: string, usedIds: Set<string>) {
  const numbered = sourceId.match(/^(.*?)(\d+)$/)
  let candidate: string
  if (numbered) {
    const prefix = numbered[1]
    const width = numbered[2].length
    let number = Number(numbered[2]) + 1
    candidate = `${prefix}${String(number).padStart(width, '0')}`
    while (usedIds.has(candidate)) candidate = `${prefix}${String(++number).padStart(width, '0')}`
  } else {
    let index = 1
    candidate = `${sourceId}_COPY`
    while (usedIds.has(candidate)) candidate = `${sourceId}_COPY_${++index}`
  }
  usedIds.add(candidate)
  return candidate
}

interface SceneState {
  objects: IndustrialAsset[]
  selectedObjectId: string | null
  selectedObjectIds: string[]
  primarySelectedObjectId: string | null
  editMode: EditMode
  activeRotationAxis: RotationAxis
  referenceLayout: ReferenceLayout | null
  snap: SnapSettings
  view: ViewSettings
  plantLevels: PlantLevelDefinition[]
  activeLevel: InsertionLevelCode
  visibleLevelFilter: VisibleLevelFilter
  showLevel0Grid: boolean
  showLevel1Grid: boolean
  focusRequest: { id: string; nonce: number } | null
  focusAreaRequest: { areaFilter: AreaFilter; nonce: number } | null
  cameraViewRequest: { mode: CameraViewMode; nonce: number } | null
  layoutCalibration: { active: boolean; pointA?: ReferenceLayout['calibration']['pointA']; pointB?: ReferenceLayout['calibration']['pointB'] }
  layoutCrop: { active: boolean; draft?: ReferenceLayout['crop'] }
  historyPast: HistoryEntry[]
  historyFuture: HistoryEntry[]
  clipboard: ClipboardState | null
  editorFeedback: { message: string; nonce: number } | null
  beginHistoryTransaction: (label: string) => void
  commitHistoryTransaction: (label?: string) => void
  cancelHistoryTransaction: () => void
  clearHistory: () => void
  undo: () => boolean
  redo: () => boolean
  copySelection: () => number
  pasteClipboard: () => number
  addObject: (object: IndustrialAsset) => void
  updateObject: (id: string, update: Partial<IndustrialAsset>) => void
  renameObjectId: (oldId: string, newId: string) => boolean
  scaleObjectUniformly: (id: string, factor: number) => void
  setObjectUniformScale: (id: string, scale: number) => void
  scaleSelectedObjectsIndividually: (objectIds: string[], factor: number) => ScaleSelectionResult
  resetSelectedObjectsUniformScale: (objectIds: string[]) => ScaleSelectionResult
  deleteObject: (id: string) => void
  deleteObjects: (ids: string[]) => void
  duplicateObject: (id: string) => void
  selectObject: (id: string | null) => void
  selectOnly: (id: string) => void
  toggleObjectSelection: (id: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  setPrimarySelection: (id: string) => void
  getPrimarySelectedObjectId: () => string | null
  getSelectedObjects: () => IndustrialAsset[]
  alignSelected: (axis: AlignmentAxis, mode: AlignmentMode, referenceId?: string) => { aligned: number; locked: number; missing: number }
  setSelectedLocked: (locked: boolean) => void
  updateObjectsTransform: (updates: Array<{ id: string; position: Vector3Data; rotation: Vector3Data; uniformScale?: number }>) => void
  setEditMode: (mode: EditMode) => void
  setActiveRotationAxis: (axis: RotationAxis) => void
  rotateSelectedByDegrees: (degrees: number) => void
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
  setActiveLevel: (level: InsertionLevelCode) => void
  setVisibleLevelFilter: (filter: VisibleLevelFilter) => void
  updateLevelElevation: (level: InsertionLevelCode, elevation: number) => void
  setGridVisible: (level: InsertionLevelCode, visible: boolean) => void
  setSelectedLevel: (level: PlantLevelCode) => void
  snapObjectToLevel: (id: string) => void
  calculateChainBedInclination: (id: string) => void
  focusObject: (id: string) => void
  focusArea: () => void
  requestCameraView: (mode: CameraViewMode) => void
  clearScene: () => void
  resetProject: () => void
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

export const useSceneStore = create<SceneState>((set, get) => {
  let activeHistoryTransaction: { label: string; before: HistorySnapshot } | null = null

  const captureSnapshot = (): HistorySnapshot => {
    const state = get()
    return {
      objects: cloneObjects(state.objects),
      plantLevels: structuredClone(state.plantLevels),
      selectedObjectId: state.selectedObjectId,
      selectedObjectIds: [...state.selectedObjectIds],
      primarySelectedObjectId: state.primarySelectedObjectId,
    }
  }

  const pushHistory = (label: string, before: HistorySnapshot, coalesceKey?: string) => {
    const after = captureSnapshot()
    if (snapshotsEqual(before, after)) return
    const timestamp = Date.now()
    set((state) => {
      const previous = state.historyPast[state.historyPast.length - 1]
      const canCoalesce = Boolean(
        coalesceKey
        && previous?.coalesceKey === coalesceKey
        && timestamp - previous.timestamp <= HISTORY_COALESCE_MS
        && state.historyFuture.length === 0,
      )
      if (canCoalesce && snapshotsEqual(previous.before, after)) {
        return { historyPast: state.historyPast.slice(0, -1), historyFuture: [] }
      }
      const entry: HistoryEntry = canCoalesce
        ? { ...previous, label, timestamp, after }
        : { id: `${timestamp}-${Math.random().toString(36).slice(2, 8)}`, label, timestamp, coalesceKey, before, after }
      const historyPast = canCoalesce
        ? [...state.historyPast.slice(0, -1), entry]
        : [...state.historyPast, entry].slice(-MAX_HISTORY)
      return { historyPast, historyFuture: [] }
    })
  }

  const recordMutation = (label: string, mutate: () => void, coalesceKey?: string) => {
    const before = activeHistoryTransaction ? null : captureSnapshot()
    mutate()
    if (before) pushHistory(label, before, coalesceKey)
  }

  const restoreSnapshot = (snapshot: HistorySnapshot) => ({
    objects: cloneObjects(snapshot.objects),
    plantLevels: structuredClone(snapshot.plantLevels),
    selectedObjectId: snapshot.selectedObjectId,
    selectedObjectIds: [...snapshot.selectedObjectIds],
    primarySelectedObjectId: snapshot.primarySelectedObjectId,
    focusRequest: null,
    focusAreaRequest: null,
  })

  return ({
  objects: cloneInitial(),
  selectedObjectId: null,
  selectedObjectIds: [],
  primarySelectedObjectId: null,
  editMode: 'move',
  activeRotationAxis: 'y',
  referenceLayout: null,
  snap: defaultSnap,
  view: defaultView,
  plantLevels: structuredClone(DEFAULT_PLANT_LEVELS),
  activeLevel: DEFAULT_ACTIVE_LEVEL,
  visibleLevelFilter: DEFAULT_VISIBLE_LEVEL_FILTER,
  showLevel0Grid: false,
  showLevel1Grid: true,
  focusRequest: null,
  focusAreaRequest: null,
  cameraViewRequest: null,
  layoutCalibration: { active: false },
  layoutCrop: { active: false },
  historyPast: [],
  historyFuture: [],
  clipboard: null,
  editorFeedback: null,
  beginHistoryTransaction: (label) => {
    if (!activeHistoryTransaction) activeHistoryTransaction = { label, before: captureSnapshot() }
  },
  commitHistoryTransaction: (label) => {
    const transaction = activeHistoryTransaction
    activeHistoryTransaction = null
    if (transaction) pushHistory(label ?? transaction.label, transaction.before)
  },
  cancelHistoryTransaction: () => { activeHistoryTransaction = null },
  clearHistory: () => {
    activeHistoryTransaction = null
    set({ historyPast: [], historyFuture: [] })
  },
  undo: () => {
    activeHistoryTransaction = null
    const past = get().historyPast
    const entry = past[past.length - 1]
    if (!entry) return false
    set((state) => ({
      ...restoreSnapshot(entry.before),
      historyPast: state.historyPast.slice(0, -1),
      historyFuture: [entry, ...state.historyFuture],
      editorFeedback: { message: `Deshecho: ${entry.label}`, nonce: Date.now() },
    }))
    return true
  },
  redo: () => {
    activeHistoryTransaction = null
    const entry = get().historyFuture[0]
    if (!entry) return false
    set((state) => ({
      ...restoreSnapshot(entry.after),
      historyPast: [...state.historyPast, entry].slice(-MAX_HISTORY),
      historyFuture: state.historyFuture.slice(1),
      editorFeedback: { message: `Rehecho: ${entry.label}`, nonce: Date.now() },
    }))
    return true
  },
  copySelection: () => {
    const state = get()
    const objects = state.selectedObjectIds
      .map((id) => state.objects.find((object) => object.id === id))
      .filter(Boolean) as IndustrialAsset[]
    if (objects.length === 0) return 0
    const min = objects.reduce((point, object) => ({
      x: Math.min(point.x, object.position.x),
      y: Math.min(point.y, object.position.y),
      z: Math.min(point.z, object.position.z),
    }), { x: Infinity, y: Infinity, z: Infinity })
    const max = objects.reduce((point, object) => ({
      x: Math.max(point.x, object.position.x),
      y: Math.max(point.y, object.position.y),
      z: Math.max(point.z, object.position.z),
    }), { x: -Infinity, y: -Infinity, z: -Infinity })
    set({
      clipboard: {
        objects: cloneObjects(objects),
        center: { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 },
        pasteCount: 0,
      },
      editorFeedback: { message: `${objects.length} ${objects.length === 1 ? 'objeto copiado' : 'objetos copiados'}`, nonce: Date.now() },
    })
    return objects.length
  },
  pasteClipboard: () => {
    const clipboard = get().clipboard
    if (!clipboard?.objects.length) return 0
    const pasteIndex = clipboard.pasteCount + 1
    const insertion = getCurrentInsertionPoint()
    const pasteCenter = { x: insertion.x + pasteIndex, y: clipboard.center.y, z: insertion.z + pasteIndex }
    let pastedCount = 0
    recordMutation(`Pegar ${clipboard.objects.length} ${clipboard.objects.length === 1 ? 'objeto' : 'objetos'}`, () => set((state) => {
      const usedIds = new Set(state.objects.map((object) => object.id))
      const pasted = clipboard.objects.map((source) => {
        const duplicate = structuredClone(source)
        duplicate.id = copyIdFor(source.id, usedIds)
        duplicate.name = `${source.name || source.id} (copia)`
        duplicate.position = {
          x: pasteCenter.x + source.position.x - clipboard.center.x,
          y: pasteCenter.y + source.position.y - clipboard.center.y,
          z: pasteCenter.z + source.position.z - clipboard.center.z,
        }
        return normalizeObject(duplicate)
      })
      const selectedObjectIds = pasted.map((object) => object.id)
      pastedCount = pasted.length
      return {
        objects: [...state.objects, ...pasted],
        selectedObjectIds,
        selectedObjectId: selectedObjectIds[selectedObjectIds.length - 1] ?? null,
        primarySelectedObjectId: selectedObjectIds[selectedObjectIds.length - 1] ?? null,
        clipboard: { ...clipboard, pasteCount: pasteIndex },
        editorFeedback: { message: `${pasted.length} ${pasted.length === 1 ? 'objeto pegado' : 'objetos pegados'}`, nonce: Date.now() },
        focusRequest: null,
        focusAreaRequest: null,
      }
    }))
    return pastedCount
  },
  addObject: (object) => recordMutation(`Agregar ${object.id}`, () => set((state) => {
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
  })),
  updateObject: (id, update) => recordMutation(
    `Editar ${id}`,
    () => set((state) => ({
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
    `update:${id}:${Object.keys(update).sort().join(',')}`,
  ),
  renameObjectId: (oldId, newId) => {
    const normalizedId = newId.trim().toUpperCase()
    if (!normalizedId || !/^[A-Z0-9_-]+$/.test(normalizedId)) return false
    if (get().objects.some((object) => object.id === normalizedId && object.id !== oldId)) return false
    if (normalizedId === oldId) return true
    let renamed = false
    recordMutation(`Cambiar ID ${oldId} -> ${normalizedId}`, () => set((state) => {
      if (!state.objects.some((object) => object.id === oldId)) return state
      if (state.objects.some((object) => object.id === normalizedId && object.id !== oldId)) return state
      renamed = true
      const replaceId = (id: string | null) => id === oldId ? normalizedId : id
      return {
        objects: state.objects.map((object) => object.id === oldId ? { ...object, id: normalizedId } : object),
        selectedObjectId: replaceId(state.selectedObjectId),
        selectedObjectIds: state.selectedObjectIds.map((id) => replaceId(id) ?? id),
        primarySelectedObjectId: replaceId(state.primarySelectedObjectId),
        focusRequest: state.focusRequest?.id === oldId ? { ...state.focusRequest, id: normalizedId } : state.focusRequest,
      }
    }))
    return renamed
  },
  scaleObjectUniformly: (id, factor) => recordMutation(`Escalar ${id}`, () => set((state) => ({
    objects: state.objects.map((object) => object.id === id && !object.locked && Number.isFinite(factor) && factor > 0
      ? applyUniformScale(object, object.uniformScale * factor)
      : object),
  }))),
  setObjectUniformScale: (id, scale) => recordMutation(`Escalar ${id}`, () => set((state) => ({
    objects: state.objects.map((object) => object.id === id && !object.locked
      ? applyUniformScale(object, scale)
      : object),
  }))),
  scaleSelectedObjectsIndividually: (objectIds, factor) => {
    const result: ScaleSelectionResult = { scaled: 0, locked: 0, missing: 0 }
    const validFactor = Number.isFinite(factor) && factor > 0
    const requested = new Set(objectIds)
    if (!validFactor || requested.size === 0) return result

    recordMutation(`Escalar proporcionalmente ${requested.size} ${requested.size === 1 ? 'objeto' : 'objetos'}`, () => set((state) => {
      const existingIds = new Set(state.objects.map((object) => object.id))
      result.missing = [...requested].filter((id) => !existingIds.has(id)).length
      const objects = state.objects.map((object) => {
        if (!requested.has(object.id)) return object
        if (object.locked) {
          result.locked += 1
          return object
        }
        const scaled = applyUniformScale(object, object.uniformScale * factor)
        if (scaled.uniformScale !== object.uniformScale) result.scaled += 1
        return scaled
      })
      const omitted = result.locked > 0 ? ` ${result.locked} ${result.locked === 1 ? 'bloqueado omitido' : 'bloqueados omitidos'}.` : ''
      const direction = factor > 1 ? ` +${Math.round((factor - 1) * 100)}%` : factor < 1 ? ` -${Math.round((1 / factor - 1) * 100)}%` : ''
      return {
        objects,
        editorFeedback: {
          message: `${result.scaled} ${result.scaled === 1 ? 'objeto escalado' : 'objetos escalados'}${direction}.${omitted}`,
          nonce: Date.now(),
        },
      }
    }))
    return result
  },
  resetSelectedObjectsUniformScale: (objectIds) => {
    const result: ScaleSelectionResult = { scaled: 0, locked: 0, missing: 0 }
    const requested = new Set(objectIds)
    if (requested.size === 0) return result

    recordMutation(`Resetear escala de ${requested.size} ${requested.size === 1 ? 'objeto' : 'objetos'}`, () => set((state) => {
      const existingIds = new Set(state.objects.map((object) => object.id))
      result.missing = [...requested].filter((id) => !existingIds.has(id)).length
      const objects = state.objects.map((object) => {
        if (!requested.has(object.id)) return object
        if (object.locked) {
          result.locked += 1
          return object
        }
        const scaled = applyUniformScale(object, 1)
        if (scaled.uniformScale !== object.uniformScale) result.scaled += 1
        return scaled
      })
      const omitted = result.locked > 0 ? ` ${result.locked} ${result.locked === 1 ? 'bloqueado omitido' : 'bloqueados omitidos'}.` : ''
      return {
        objects,
        editorFeedback: {
          message: `${result.scaled} ${result.scaled === 1 ? 'escala restaurada' : 'escalas restauradas'} a 1.00x.${omitted}`,
          nonce: Date.now(),
        },
      }
    }))
    return result
  },
  deleteObject: (id) => recordMutation(`Eliminar ${id}`, () => set((state) => {
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
  })),
  deleteObjects: (ids) => recordMutation(`Eliminar ${ids.length} ${ids.length === 1 ? 'objeto' : 'objetos'}`, () => set((state) => {
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
  })),
  duplicateObject: (id) => recordMutation(`Duplicar ${id}`, () => set((state) => {
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
  })),
  selectObject: (id) => set({
    selectedObjectId: id,
    selectedObjectIds: id ? [id] : [],
    primarySelectedObjectId: id,
  }),
  selectOnly: (id) => set({ selectedObjectId: id, selectedObjectIds: [id], primarySelectedObjectId: id }),
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
  toggleSelection: (id) => get().toggleObjectSelection(id),
  clearSelection: () => set({ selectedObjectId: null, selectedObjectIds: [], primarySelectedObjectId: null }),
  setPrimarySelection: (id) => set((state) => state.selectedObjectIds.includes(id)
    ? { primarySelectedObjectId: id, selectedObjectId: id }
    : state),
  getPrimarySelectedObjectId: () => get().primarySelectedObjectId,
  getSelectedObjects: () => {
    const state = get()
    return state.selectedObjectIds.map((id) => state.objects.find((object) => object.id === id)).filter(Boolean) as IndustrialAsset[]
  },
  alignSelected: (axis, mode, referenceId) => {
    let result = { aligned: 0, locked: 0, missing: 0 }
    recordMutation(`Alinear ${get().selectedObjectIds.length} objetos`, () => {
      set((state) => {
        if (state.selectedObjectIds.length < 2) return state
        const primaryId = referenceId && state.selectedObjectIds.includes(referenceId) ? referenceId : state.primarySelectedObjectId
        if (!primaryId) return state
        const referenceBounds = getObjectWorldBounds(primaryId)
        if (!referenceBounds) {
          result.missing = state.selectedObjectIds.length
          return state
        }
        const coordinate = (bounds: NonNullable<typeof referenceBounds>) => mode === 'min'
          ? bounds.min[axis]
          : mode === 'max' ? bounds.max[axis] : (bounds.min[axis] + bounds.max[axis]) / 2
        const target = coordinate(referenceBounds)
        const selected = new Set(state.selectedObjectIds)
        const objects = state.objects.map((object) => {
          if (!selected.has(object.id) || object.id === primaryId) return object
          if (object.locked) {
            result.locked += 1
            return object
          }
          const bounds = getObjectWorldBounds(object.id)
          if (!bounds) {
            result.missing += 1
            return object
          }
          result.aligned += 1
          return { ...object, position: { ...object.position, [axis]: object.position[axis] + target - coordinate(bounds) } }
        })
        return { objects }
      })
    })
    return result
  },
  setSelectedLocked: (locked) => recordMutation(`${locked ? 'Bloquear' : 'Desbloquear'} seleccion`, () => set((state) => {
    const selected = new Set(state.selectedObjectIds)
    return { objects: state.objects.map((object) => selected.has(object.id) ? { ...object, locked } : object) }
  })),
  updateObjectsTransform: (updates) => recordMutation(
    `Transformar ${updates.length} ${updates.length === 1 ? 'objeto' : 'objetos'}`,
    () => set((state) => {
    if (updates.length === 0) return state
    const byId = new Map(updates.map((update) => [update.id, update]))
    return {
      objects: state.objects.map((object) => {
        const transform = byId.get(object.id)
        if (!transform || object.locked) return object
        return normalizeObject({
          ...object,
          position: transform.position,
          rotation: transform.rotation,
          uniformScale: transform.uniformScale ?? object.uniformScale,
        })
      }),
    }
    }),
  ),
  setEditMode: (mode) => set({ editMode: mode }),
  setActiveRotationAxis: (axis) => set({ activeRotationAxis: axis }),
  rotateSelectedByDegrees: (degrees) => recordMutation(`Rotar ${Math.abs(degrees)}Â°`, () => set((state) => {
    if (state.selectedObjectIds.length !== 1) return state
    const id = state.selectedObjectId
    if (!id) return state
    const radians = degrees * Math.PI / 180
    return {
      objects: state.objects.map((object) => object.id === id && !object.locked
        ? normalizeObject({
          ...object,
          rotation: { ...object.rotation, [state.activeRotationAxis]: object.rotation[state.activeRotationAxis] + radians },
        })
        : object),
    }
  })),
  setLayout: (layout) => set({ referenceLayout: layout ? normalizeLayout(layout) : null }),
  updateLayout: (update) => set((state) => ({ referenceLayout: state.referenceLayout ? normalizeLayout({ ...state.referenceLayout, ...update }) : null })),
  centerLayout: () => set((state) => ({ referenceLayout: state.referenceLayout ? { ...state.referenceLayout, position: { ...state.referenceLayout.position, x: 0, z: 0 } } : null })),
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
    const visible = (object: IndustrialAsset) => (view.areaFilter === AREA_FILTER_ALL || object.areaCode === view.areaFilter)
      && isLevelVisible(object.levelCode, state.visibleLevelFilter)
    const selectedObjectIds = state.selectedObjectIds.filter((id) => state.objects.some((object) => object.id === id && visible(object)))
    const primarySelectedObjectId = selectedObjectIds.includes(state.primarySelectedObjectId ?? '') ? state.primarySelectedObjectId : selectedObjectIds[0] ?? null
    localStorage.setItem(THEME_KEY, view.theme)
    return { view, selectedObjectIds, primarySelectedObjectId, selectedObjectId: primarySelectedObjectId }
  }),
  setActiveLevel: (level) => set({
    activeLevel: normalizeInsertionLevel(level),
    showLevel0Grid: level === LEVEL_0,
    showLevel1Grid: level === LEVEL_1,
  }),
  setVisibleLevelFilter: (filter) => set((state) => {
    const visibleLevelFilter = normalizeVisibleLevelFilter(filter)
    const visible = (object: IndustrialAsset) => (state.view.areaFilter === AREA_FILTER_ALL || object.areaCode === state.view.areaFilter)
      && isLevelVisible(object.levelCode, visibleLevelFilter)
    const selectedObjectIds = state.selectedObjectIds.filter((id) => state.objects.some((object) => object.id === id && visible(object)))
    const primarySelectedObjectId = selectedObjectIds.includes(state.primarySelectedObjectId ?? '') ? state.primarySelectedObjectId : selectedObjectIds[0] ?? null
    return { visibleLevelFilter, selectedObjectIds, primarySelectedObjectId, selectedObjectId: primarySelectedObjectId }
  }),
  updateLevelElevation: (level, elevation) => {
    if (!Number.isFinite(elevation)) return
    recordMutation(`Cambiar elevacion de ${level === LEVEL_0 ? 'Nivel 0' : 'Nivel 1'}`, () => set((state) => ({
      plantLevels: state.plantLevels.map((item) => item.code === level ? { ...item, elevation } : item),
    })))
  },
  setGridVisible: (level, visible) => set(level === LEVEL_0 ? { showLevel0Grid: visible } : { showLevel1Grid: visible }),
  setSelectedLevel: (level) => recordMutation('Cambiar nivel de seleccion', () => set((state) => {
    const selected = new Set(state.selectedObjectIds)
    return { objects: state.objects.map((object) => selected.has(object.id) && !object.locked ? { ...object, levelCode: normalizeLevelCode(level) } : object) }
  })),
  snapObjectToLevel: (id) => recordMutation(`Ajustar ${id} a elevacion de nivel`, () => set((state) => ({
    objects: state.objects.map((object) => {
      if (object.id !== id || object.locked || object.levelCode === MULTI_LEVEL) return object
      const elevation = getLevelElevation(state.plantLevels, object.levelCode)
      return { ...object, position: { ...object.position, y: elevation + object.size.height * object.uniformScale / 2 } }
    }),
  }))),
  calculateChainBedInclination: (id) => recordMutation(`Calcular inclinacion de ${id}`, () => set((state) => ({
    objects: state.objects.map((object) => {
      if (object.id !== id || object.type !== 'chain_bed' || object.locked) return object
      const startLevel = normalizeInsertionLevel(object.params.startLevel)
      const endLevel = normalizeInsertionLevel(object.params.endLevel)
      const startOffset = finiteOr(object.params.startElevationOffset, 0)
      const endOffset = finiteOr(object.params.endElevationOffset, 0)
      const run = positiveOr(object.params.horizontalRun, positiveOr(object.params.length, object.size.width))
      const startElevation = getLevelElevation(state.plantLevels, startLevel) + startOffset
      const endElevation = getLevelElevation(state.plantLevels, endLevel) + endOffset
      const angle = Math.atan2(endElevation - startElevation, run)
      return normalizeObject({
        ...object,
        levelCode: MULTI_LEVEL,
        position: { ...object.position, y: (startElevation + endElevation) / 2 + object.size.height * object.uniformScale / 2 },
        rotation: { ...object.rotation, z: angle },
        params: { ...object.params, placementMode: 'inclinedBetweenLevels', horizontalRun: run, inclinationAngle: angle * 180 / Math.PI },
      })
    }),
  }))),
  focusObject: (id) => set({ selectedObjectId: id, selectedObjectIds: [id], primarySelectedObjectId: id, focusRequest: { id, nonce: Date.now() } }),
  focusArea: () => set((state) => ({ focusAreaRequest: { areaFilter: state.view.areaFilter, nonce: Date.now() } })),
  requestCameraView: (mode) => set((state) => {
    const activeCameraPreset = cameraPresetForViewMode[mode]
    return {
      cameraViewRequest: { mode, nonce: Date.now() },
      view: activeCameraPreset ? { ...state.view, activeCameraPreset } : state.view,
    }
  }),
  clearScene: () => {
    activeHistoryTransaction = null
    set({ objects: [], selectedObjectId: null, selectedObjectIds: [], primarySelectedObjectId: null, focusRequest: null, focusAreaRequest: null, cameraViewRequest: null, historyPast: [], historyFuture: [], clipboard: null })
  },
  resetProject: () => {
    activeHistoryTransaction = null
    set({
    objects: [],
    selectedObjectId: null,
    selectedObjectIds: [],
    primarySelectedObjectId: null,
    editMode: 'move',
    activeRotationAxis: 'y',
    referenceLayout: null,
    snap: { ...defaultSnap },
    view: { ...defaultView },
    plantLevels: structuredClone(DEFAULT_PLANT_LEVELS),
    activeLevel: DEFAULT_ACTIVE_LEVEL,
    visibleLevelFilter: DEFAULT_VISIBLE_LEVEL_FILTER,
    showLevel0Grid: false,
    showLevel1Grid: true,
    focusRequest: null,
    focusAreaRequest: null,
    cameraViewRequest: null,
    layoutCalibration: { active: false },
    layoutCrop: { active: false },
    historyPast: [],
    historyFuture: [],
    clipboard: null,
    })
  },
  loadScene: (document) => {
    activeHistoryTransaction = null
    if (Array.isArray(document)) {
      set({ objects: normalizeObjects(document), plantLevels: structuredClone(DEFAULT_PLANT_LEVELS), activeLevel: DEFAULT_ACTIVE_LEVEL, visibleLevelFilter: DEFAULT_VISIBLE_LEVEL_FILTER, showLevel0Grid: false, showLevel1Grid: true, selectedObjectId: null, selectedObjectIds: [], primarySelectedObjectId: null, focusRequest: null, focusAreaRequest: null, cameraViewRequest: null, historyPast: [], historyFuture: [], clipboard: null })
      return
    }
    const plantLevels = normalizePlantLevels(document.plantLevels)
    const rawLayout = document.referenceLayout ?? document.layout
    const layoutLevel = rawLayout?.levelCode === LEVEL_0 ? LEVEL_0 : LEVEL_1
    const layoutElevation = getLevelElevation(plantLevels, layoutLevel)
    set({
      objects: normalizeObjects(document.objects),
      referenceLayout: normalizeLayout(rawLayout, layoutElevation),
      snap: normalizeSnap(document.snap),
      view: normalizeView(document.view),
      plantLevels,
      activeLevel: normalizeInsertionLevel(document.activeLevel),
      visibleLevelFilter: normalizeVisibleLevelFilter(document.visibleLevelFilter),
      showLevel0Grid: typeof document.showLevel0Grid === 'boolean' ? document.showLevel0Grid : document.activeLevel === LEVEL_0,
      showLevel1Grid: typeof document.showLevel1Grid === 'boolean' ? document.showLevel1Grid : document.activeLevel !== LEVEL_0,
      selectedObjectId: null,
      selectedObjectIds: [],
      primarySelectedObjectId: null,
      focusRequest: null,
      focusAreaRequest: null,
      cameraViewRequest: null,
      historyPast: [],
      historyFuture: [],
      clipboard: null,
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
      plantLevels: state.plantLevels,
      activeLevel: state.activeLevel,
      visibleLevelFilter: state.visibleLevelFilter,
      showLevel0Grid: state.showLevel0Grid,
      showLevel1Grid: state.showLevel1Grid,
    }
    return JSON.stringify(document, null, 2)
  },
  importScene: (json) => {
    const parsed: unknown = JSON.parse(json)
    if (isObjectList(parsed)) get().loadScene(parsed)
    else if (isDocument(parsed)) get().loadScene(parsed)
    else throw new Error('El JSON no contiene una escena valida.')
  },
  })
})
