import { useRef, useState } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import type { EditMode, LayoutImage } from '../../types/plant'

const numberFromInput = (input: HTMLInputElement, fallback: number) => {
  const value = input.valueAsNumber
  if (Number.isFinite(value)) return value
  const parsed = Number(input.value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function readImage(file: File): Promise<LayoutImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const image = new Image()
      image.onerror = () => reject(new Error('La imagen no es valida.'))
      image.onload = () => resolve({
        dataUrl,
        fileName: file.name,
        mimeType: file.type,
        widthPx: image.naturalWidth,
        heightPx: image.naturalHeight,
        scale: 1,
        opacity: 0.72,
        visible: true,
      })
      image.src = dataUrl
    }
    reader.readAsDataURL(file)
  })
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
      notify('Escena importada')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'No se pudo importar')
    }
  }

  const importLayout = async (file?: File) => {
    if (!file) return
    try {
      store.setLayout(await readImage(file))
      notify('Layout importado')
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
        <input ref={layoutInputRef} hidden type="file" accept="image/png,image/jpeg,.png,.jpg,.jpeg" onChange={(e) => { void importLayout(e.target.files?.[0]); e.target.value = '' }} />
        <span className="separator" />
        {modeButton('move', 'Mover')}
        {modeButton('rotate', 'Rotar')}
        {modeButton('scale', 'Escalar')}
        <span className="separator" />
        <label className="toolbar-check"><input type="checkbox" checked={store.snap.enabled} onChange={(e) => store.updateSnap({ enabled: e.target.checked })} /> Snap</label>
        <label className="toolbar-number">Grilla <input type="number" min="0.1" step="0.1" value={store.snap.gridSize} onChange={(e) => store.updateSnap({ gridSize: Math.max(0.1, numberFromInput(e.currentTarget, store.snap.gridSize || 0.5)) })} /></label>
        <label className="toolbar-check"><input type="checkbox" checked={store.view.showLabels} onChange={(e) => store.updateView({ showLabels: e.target.checked })} /> Labels</label>
        <select value={store.view.labelMode} onChange={(e) => store.updateView({ labelMode: e.target.value as 'id' | 'name' })}>
          <option value="id">ID</option>
          <option value="name">Nombre</option>
        </select>
        <select value={store.view.colorMode} onChange={(e) => store.updateView({ colorMode: e.target.value as 'manual' | 'criticality' })}>
          <option value="manual">Color manual</option>
          <option value="criticality">Por criticidad</option>
        </select>
        <span className="separator" />
        <button disabled={!store.selectedObjectId} onClick={() => store.selectedObjectId && store.duplicateObject(store.selectedObjectId)}>Duplicar</button>
        <button className="danger" disabled={!store.selectedObjectId} onClick={() => store.selectedObjectId && store.deleteObject(store.selectedObjectId)}>Eliminar</button>
      </div>
      {store.layout && (
        <div className="layout-controls">
          <label><input type="checkbox" checked={store.layout.visible} onChange={(e) => store.updateLayout({ visible: e.target.checked })} /> Mostrar layout</label>
          <label>Escala <input type="range" min="0.2" max="5" step="0.05" value={store.layout.scale} onChange={(e) => store.updateLayout({ scale: Number(e.target.value) })} /></label>
          <label>Opacidad <input type="range" min="0.05" max="1" step="0.05" value={store.layout.opacity} onChange={(e) => store.updateLayout({ opacity: Number(e.target.value) })} /></label>
          <button onClick={store.centerLayout}>Centrar en origen</button>
          <span className="layout-name">{store.layout.fileName}</span>
        </div>
      )}
      <div className="toolbar-status"><span className="status-dot" /> {message}</div>
    </header>
  )
}
