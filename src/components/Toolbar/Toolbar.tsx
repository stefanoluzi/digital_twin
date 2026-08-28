import { useEffect, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { fileToDataUrl } from '../../services/dataUrlService'
import { openProjectFile, saveProjectFile, saveProjectFileAs, createNewProjectSession } from '../../services/projectSessionService'
import { useProjectStore } from '../../store/projectStore'
import { useSceneStore } from '../../store/sceneStore'
import type { ReferenceLayout } from '../../types/plant'
import type { AlignmentAxis, AlignmentMode } from '../../types/plant'
import type { CameraPresetId, PlantFrontDirection } from '../../config/cameraPresets'
import { LEVEL_1 } from '../../config/plantLevels'
import { deleteAssetsWithMaintenancePolicy } from '../../services/assetMaintenanceCommands'
import { requestAssetDeletePolicy } from '../../services/maintenanceDeletePolicyDialog'
import { AreaNavigationMenu } from './AreaNavigationMenu'
import { EditMenu } from './EditMenu'
import { FileMenu } from './FileMenu'
import { LayoutMenu } from './LayoutMenu'
import { LevelsMenu } from './LevelsMenu'
import { SnapMenu } from './SnapMenu'
import { TransformModeControl } from './TransformModeControl'
import { ViewMenu } from './ViewMenu'
import { VisualizationMenu } from './VisualizationMenu'
import { useVisualizationStore } from '../../visualization/visualizationStore'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

function makeReferenceLayout(file: File, textureDataUrl: string, widthPx: number, heightPx: number, mimeType = file.type): ReferenceLayout {
  const aspectRatio = widthPx / Math.max(1, heightPx)
  const baseWidth = 20
  return {
    levelCode: LEVEL_1,
    positionMode: 'level-relative',
    textureDataUrl,
    sourceDataUrl: textureDataUrl,
    sourceType: mimeType === 'application/pdf' ? 'pdf' : 'image',
    layoutPath: file.name,
    fileName: file.name,
    mimeType,
    widthPx,
    heightPx,
    naturalWidth: widthPx,
    naturalHeight: heightPx,
    aspectRatio,
    baseWidth,
    baseHeight: baseWidth / Math.max(0.0001, aspectRatio),
    uniformScale: 1,
    stretchWidth: 1,
    stretchHeight: 1,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    opacity: 0.4,
    visible: true,
    locked: false,
    lockAspectRatio: true,
    calibration: { calibrated: false },
    crop: { enabled: false, uMin: 0, vMin: 0, uMax: 1, vMax: 1 },
    missing: false,
  }
}

function readImage(file: File): Promise<ReferenceLayout> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const image = new Image()
      image.onerror = () => reject(new Error('La imagen no es valida.'))
      image.onload = () => resolve(makeReferenceLayout(file, dataUrl, image.naturalWidth, image.naturalHeight))
      image.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
}

async function readPdf(file: File): Promise<ReferenceLayout> {
  const sourceDataUrl = await fileToDataUrl(file)
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo preparar el canvas del PDF.')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvas, canvasContext: context, viewport }).promise
  return { ...makeReferenceLayout(file, canvas.toDataURL('image/png'), canvas.width, canvas.height, 'application/pdf'), sourceDataUrl, sourceType: 'pdf' }
}

function readReferenceLayout(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? readPdf(file) : readImage(file)
}

export function Toolbar() {
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const layoutInputRef = useRef<HTMLInputElement>(null)
  const sessionInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('Listo')
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const store = useSceneStore()
  const projectState = useProjectStore()
  const presentationLevel = useVisualizationStore((state) => state.presentationLevel)
  const visualPreset = useVisualizationStore((state) => state.visualPreset)
  const requestOverview = useVisualizationStore((state) => state.requestOverview)
  const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage('Listo'), 2400) }
  const cameraModeForPreset: Partial<Record<CameraPresetId, Parameters<typeof store.requestCameraView>[0]>> = {
    TOP: 'top',
    FRONT: 'front',
    BACK: 'back',
    LEFT: 'left',
    RIGHT: 'right',
    ISO_FRONT: 'isometric',
    ISO_BACK: 'isometric_back',
  }
  const changePlantFrontDirection = (plantFrontDirection: PlantFrontDirection) => {
    const activeMode = cameraModeForPreset[store.view.activeCameraPreset]
    store.updateView({ plantFrontDirection })
    if (activeMode) store.requestCameraView(activeMode)
  }

  useEffect(() => {
    if (!store.editorFeedback) return
    setMessage(store.editorFeedback.message)
    const timer = window.setTimeout(() => setMessage('Listo'), 2400)
    return () => window.clearTimeout(timer)
  }, [store.editorFeedback])

  useEffect(() => {
    const closeMenus = () => setOpenMenu(null)
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeMenus() }
    document.addEventListener('pointerdown', closeMenus)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeMenus)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const toggleMenu = (id: string) => setOpenMenu((current) => current === id ? null : id)
  const runMenuAction = (action: () => void) => { setOpenMenu(null); action() }

  const exportFile = () => {
    const blob = new Blob([store.exportScene()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `planta-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    notify('JSON exportado')
  }

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      store.importScene(await file.text())
      notify(useSceneStore.getState().referenceLayout?.missing ? 'Layout de referencia no encontrado.' : 'Escena importada')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo importar')
    }
  }

  const importLayout = async (file?: File) => {
    if (!file) return
    try {
      store.setLayout(await readReferenceLayout(file))
      notify('Reference layout importado')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo importar el layout')
    }
  }

  const newProject = () => {
    const result = createNewProjectSession(); if (result) notify(result.message)
  }

  const saveSession = (saveAs = false) => {
    const result = saveAs ? saveProjectFileAs() : saveProjectFile(); if (result) notify(result.message)
  }

  const openSession = async (file?: File) => {
    if (!file) return
    try {
      notify((await openProjectFile(file)).message)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'El archivo seleccionado no es una sesion valida de LACO3D.')
    }
  }

  const align = (axis: AlignmentAxis, mode: AlignmentMode) => {
    const result = store.alignSelected(axis, mode, store.primarySelectedObjectId ?? undefined)
    const skipped = result.locked + result.missing
    notify(`${result.aligned} objetos alineados${skipped ? `, ${result.locked} bloqueados y ${result.missing} sin referencia omitidos` : ''}`)
  }

  const duplicateSelection = () => {
    if (store.selectedObjectIds.length === 1) {
      store.duplicateObject(store.selectedObjectIds[0])
      return
    }
    store.copySelection()
    useSceneStore.getState().pasteClipboard()
  }

  const deleteSelection = async () => {
    const ids = [...store.selectedObjectIds]
    const policies = new Map()
    for (const assetId of ids) policies.set(assetId, await requestAssetDeletePolicy(assetId))
    deleteAssetsWithMaintenancePolicy(ids, policies)
  }

  return (
    <header className="toolbar">
      <div className="brand"><div className="brand-mark">DT</div><div><strong>{projectState.metadata.name}{projectState.isDirty ? ' *' : ''}</strong><small>PLANT EDITOR / MVP</small></div></div>
      <div className="toolbar-actions">
        <FileMenu
          open={openMenu === 'file'}
          onToggle={toggleMenu}
          onAction={runMenuAction}
          onNew={newProject}
          onOpen={() => sessionInputRef.current?.click()}
          onSave={() => saveSession(false)}
          onSaveAs={() => saveSession(true)}
          onImportLayout={() => layoutInputRef.current?.click()}
          onExportJson={exportFile}
          onImportJson={() => jsonInputRef.current?.click()}
        />
        <input ref={sessionInputRef} hidden type="file" accept=".laco3d,.json,application/json" onChange={(e) => { void openSession(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={jsonInputRef} hidden type="file" accept="application/json,.json" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={layoutInputRef} hidden type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" onChange={(e) => { void importLayout(e.target.files?.[0]); e.target.value = '' }} />

        <EditMenu open={openMenu === 'edit'} canCopy={store.selectedObjectIds.length > 0} canPaste={Boolean(store.clipboard?.objects.length)} onToggle={toggleMenu} onAction={runMenuAction} onCopy={store.copySelection} onPaste={store.pasteClipboard} />

        <div className="toolbar-history" role="group" aria-label="Historial">
        <button
          disabled={store.historyPast.length === 0}
          title={store.historyPast.length ? `Deshacer: ${store.historyPast[store.historyPast.length - 1]?.label} (Ctrl+Z)` : 'Deshacer (Ctrl+Z)'}
          aria-label="Deshacer (Ctrl+Z)"
          onClick={() => store.undo()}
        >
          ↶
        </button>
        <button
          disabled={store.historyFuture.length === 0}
          title={store.historyFuture.length ? `Rehacer: ${store.historyFuture[0]?.label} (Ctrl+Shift+Z)` : 'Rehacer (Ctrl+Shift+Z)'}
          aria-label="Rehacer (Ctrl+Shift+Z)"
          onClick={() => store.redo()}
        >
          ↷
        </button>
        </div>

        <TransformModeControl mode={store.editMode} onChange={store.setEditMode} />
        <SnapMenu open={openMenu === 'snap'} snap={store.snap} onToggle={toggleMenu} onUpdate={store.updateSnap} />
        <LevelsMenu open={openMenu === 'levels'} store={store} onToggle={toggleMenu} />

        <div className="toolbar-fit" role="group" aria-label="Encuadre de cámara">
          <button className={presentationLevel === 'OVERVIEW' ? 'active' : undefined} disabled={visualPreset !== 'DIGITAL_TWIN'} title="Vista general de presentación" onClick={requestOverview}>Overview</button>
          <button title="Encuadrar toda la planta" onClick={() => store.requestCameraView('fit_all')}>Fit All</button>
          <button title="Encuadrar selección" disabled={store.selectedObjectIds.length === 0} onClick={() => store.requestCameraView('fit_selection')}>Fit Selection</button>
        </div>

        <AreaNavigationMenu open={openMenu === 'areas'} onToggle={toggleMenu} />
        <LayoutMenu
          open={openMenu === 'layout'}
          layout={store.referenceLayout}
          editLayout={store.view.editLayout}
          calibrationActive={store.layoutCalibration.active}
          cropActive={store.layoutCrop.active}
          onToggle={toggleMenu}
          onClose={() => setOpenMenu(null)}
          onUpdateLayout={store.updateLayout}
          onEditLayout={(editLayout) => store.updateView({ editLayout })}
          onCenter={store.centerLayout}
          onFit={() => store.requestCameraView('fit_layout')}
          onCalibrate={store.startLayoutCalibration}
          onCrop={store.startLayoutCrop}
          onResetCrop={store.resetLayoutCrop}
        />
        <VisualizationMenu open={openMenu === 'visualization'} view={store.view} onToggle={toggleMenu} onUpdate={store.updateView} />
        <ViewMenu
          open={openMenu === 'view'}
          view={store.view}
          onToggle={toggleMenu}
          onClose={() => setOpenMenu(null)}
          onTheme={() => store.updateView({ theme: store.view.theme === 'dark' ? 'light' : 'dark' })}
          onRestore={projectState.requestCameraRestore}
          onFrontChange={changePlantFrontDirection}
        />

        <div className="toolbar-quick-views" role="group" aria-label="Vistas rápidas">
          <button className={store.view.activeCameraPreset === 'ISO_FRONT' ? 'active' : undefined} title="Vista isométrica frontal" onClick={() => store.requestCameraView('isometric')}>Isométrica</button>
          <button className={store.view.activeCameraPreset === 'TOP' ? 'active' : undefined} title="Vista superior" onClick={() => store.requestCameraView('top')}>Superior</button>
        </div>

        {store.selectedObjectIds.length > 0 && <div className="toolbar-object-actions" role="group" aria-label="Acciones de la selección">
          <button title="Duplicar selección" onClick={duplicateSelection}>{store.selectedObjectIds.length > 1 ? 'Duplicar selección' : 'Duplicar'}</button>
          <button className="danger" title="Eliminar selección" onClick={deleteSelection}>{store.selectedObjectIds.length > 1 ? 'Eliminar seleccionados' : 'Eliminar'}</button>
        </div>}
      </div>
      {store.selectedObjectIds.length >= 2 && (
        <div className="alignment-controls">
          <strong>Alinear ({store.selectedObjectIds.length}) respecto al primario</strong>
          <button onClick={() => align('x', 'center')}>Mismo X</button>
          <button onClick={() => align('y', 'min')}>Misma base Y</button>
          <button onClick={() => align('z', 'center')}>Mismo Z</button>
          <span className="separator" />
          <span>X</span>
          <button onClick={() => align('x', 'min')}>Min</button>
          <button onClick={() => align('x', 'center')}>Centro</button>
          <button onClick={() => align('x', 'max')}>Max</button>
          <span>Y</span>
          <button onClick={() => align('y', 'min')}>Base</button>
          <button onClick={() => align('y', 'center')}>Centro</button>
          <button onClick={() => align('y', 'max')}>Tope</button>
          <span>Z</span>
          <button onClick={() => align('z', 'min')}>Min</button>
          <button onClick={() => align('z', 'center')}>Centro</button>
          <button onClick={() => align('z', 'max')}>Max</button>
        </div>
      )}
      <div className="toolbar-status"><span className="status-dot" /> {message}</div>
    </header>
  )
}
