import { useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { AREA_FILTER_ALL, PLANT_AREAS, areaLabel, type AreaFilter } from '../../config/areas'
import { useSceneStore } from '../../store/sceneStore'
import type { ColorMode, EditMode, LabelMode, ReferenceLayout } from '../../types/plant'

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

const numberFromInput = (input: HTMLInputElement, fallback: number) => {
  const value = input.valueAsNumber
  if (Number.isFinite(value)) return value
  const parsed = Number(input.value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function makeReferenceLayout(file: File, textureDataUrl: string, widthPx: number, heightPx: number, mimeType = file.type): ReferenceLayout {
  const aspectRatio = widthPx / Math.max(1, heightPx)
  const baseWidth = 20
  return {
    textureDataUrl,
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
    position: { x: 0, y: 0.035, z: 0 },
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
  const pdf = await getDocument({ data: await file.arrayBuffer() }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('No se pudo preparar el canvas del PDF.')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvas, canvasContext: context, viewport }).promise
  return makeReferenceLayout(file, canvas.toDataURL('image/png'), canvas.width, canvas.height, 'application/pdf')
}

function readReferenceLayout(file: File) {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf') ? readPdf(file) : readImage(file)
}

export function Toolbar() {
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const layoutInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('Listo')
  const store = useSceneStore()
  const notify = (text: string) => { setMessage(text); window.setTimeout(() => setMessage('Listo'), 2400) }
  const action = (fn: () => void, ok: string) => { try { fn(); notify(ok) } catch (error) { notify(error instanceof Error ? error.message : 'Ocurrio un error') } }

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

  const modeButton = (mode: EditMode, label: string) => (
    <button className={store.editMode === mode ? 'active' : ''} onClick={() => store.setEditMode(mode)}>{label}</button>
  )

  return (
    <header className="toolbar">
      <div className="brand"><div className="brand-mark">DT</div><div><strong>INDUSTRIAL TWIN</strong><small>PLANT EDITOR / MVP</small></div></div>
      <div className="toolbar-actions">
        <button onClick={() => action(store.clearScene, 'Escena nueva')}>+ Nuevo</button>
        <button onClick={() => action(store.saveToLocalStorage, 'Guardado localmente')}>Guardar</button>
        <button onClick={() => action(() => { if (!store.loadFromLocalStorage()) throw new Error('No hay una escena guardada') }, 'Escena cargada')}>Cargar</button>
        <span className="separator" />
        <button onClick={exportFile}>Exportar JSON</button>
        <button onClick={() => jsonInputRef.current?.click()}>Importar JSON</button>
        <input ref={jsonInputRef} hidden type="file" accept="application/json,.json" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = '' }} />
        <button onClick={() => layoutInputRef.current?.click()}>Importar Layout</button>
        <input ref={layoutInputRef} hidden type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" onChange={(e) => { void importLayout(e.target.files?.[0]); e.target.value = '' }} />
        <span className="separator" />
        {modeButton('move', 'Mover')}
        {modeButton('rotate', 'Rotar')}
        {modeButton('scale', 'Escalar')}
        <span className="separator" />
        <label className="toolbar-check"><input type="checkbox" checked={store.snap.enabled} onChange={(e) => store.updateSnap({ enabled: e.target.checked })} /> Snap</label>
        <label className="toolbar-number">Grilla <input type="number" min="0.1" step="0.1" value={store.snap.gridSize} onChange={(e) => store.updateSnap({ gridSize: Math.max(0.1, numberFromInput(e.currentTarget, store.snap.gridSize || 0.5)) })} /></label>
        <label className="toolbar-check"><input type="checkbox" checked={store.view.showLabels} onChange={(e) => store.updateView({ showLabels: e.target.checked })} /> Labels</label>
        <label className="toolbar-check"><input type="checkbox" checked={store.view.showResizeHandles} onChange={(e) => store.updateView({ showResizeHandles: e.target.checked })} /> Resize handles</label>
        <select value={store.view.labelMode} onChange={(e) => store.updateView({ labelMode: e.target.value as LabelMode })}>
          <option value="id">ID</option>
          <option value="name">Nombre</option>
          <option value="area">Area</option>
        </select>
        <select value={store.view.colorMode} onChange={(e) => store.updateView({ colorMode: e.target.value as ColorMode })}>
          <option value="manual">Color manual</option>
          <option value="criticality">Por criticidad</option>
          <option value="area">Por area</option>
        </select>
        <select value={store.view.areaFilter} onChange={(e) => store.updateView({ areaFilter: e.target.value as AreaFilter })}>
          <option value={AREA_FILTER_ALL}>Todas las areas</option>
          {PLANT_AREAS.map((area) => <option key={area.code} value={area.code}>{areaLabel(area.code)}</option>)}
        </select>
        <button disabled={store.view.areaFilter === AREA_FILTER_ALL} onClick={store.focusArea}>Enfocar area</button>
        <button onClick={() => store.requestCameraView('fit_all')}>Fit All</button>
        <button disabled={!store.referenceLayout} onClick={() => store.requestCameraView('fit_layout')}>Fit Layout</button>
        <button disabled={store.selectedObjectIds.length === 0} onClick={() => store.requestCameraView('fit_selection')}>Fit Selection</button>
        <button onClick={() => store.requestCameraView('isometric')}>Vista isometrica</button>
        <button onClick={() => store.requestCameraView('top')}>Vista superior</button>
        <button onClick={() => store.updateView({ theme: store.view.theme === 'dark' ? 'light' : 'dark' })}>
          {store.view.theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
        <span className="separator" />
        <button disabled={!store.selectedObjectId} onClick={() => store.selectedObjectId && store.duplicateObject(store.selectedObjectId)}>Duplicar</button>
        <button className="danger" disabled={!store.selectedObjectId} onClick={() => store.selectedObjectId && store.deleteObject(store.selectedObjectId)}>Eliminar</button>
      </div>
      {store.referenceLayout && (
        <div className="layout-controls">
          <label><input type="checkbox" checked={store.referenceLayout.visible} onChange={(e) => store.updateLayout({ visible: e.target.checked })} /> Mostrar Layout</label>
          <label><input type="checkbox" checked={store.referenceLayout.locked} onChange={(e) => store.updateLayout({ locked: e.target.checked })} /> Lock Layout</label>
          <label><input type="checkbox" checked={store.view.editLayout} onChange={(e) => store.updateView({ editLayout: e.target.checked })} /> Editar Layout</label>
          <label>Opacity <input type="range" min="0" max="1" step="0.05" value={store.referenceLayout.opacity} onChange={(e) => store.updateLayout({ opacity: Number(e.target.value) })} /></label>
          <button onClick={store.centerLayout}>Centrar en origen</button>
          <span className="layout-name">{store.referenceLayout.fileName}</span>
        </div>
      )}
      <div className="toolbar-status"><span className="status-dot" /> {message}</div>
    </header>
  )
}
