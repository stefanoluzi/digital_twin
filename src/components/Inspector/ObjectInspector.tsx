import type { ReactNode } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { assetTypes, type Criticality, type IndustrialAsset, type PlantSystem } from '../../types/plant'

type NumberGroup = 'position' | 'rotation'
type SizeKey = keyof IndustrialAsset['size']
type DataKey = keyof IndustrialAsset['dataSources']

const labels: Record<string, string> = {
  gearbox: 'Caja reductora',
  motor: 'Motor',
  roller: 'Rodillo',
  roller_table: 'Mesa de rodillos',
  pump: 'Bomba',
  tank: 'Tanque',
  conveyor: 'Transportador',
  generic_box: 'Caja generica',
}

const systemOptions: Array<{ value: PlantSystem; label: string }> = [
  { value: '', label: 'Sin sistema' },
  { value: 'mecanico', label: 'Mecanico' },
  { value: 'hidraulico', label: 'Hidraulico' },
  { value: 'lubricacion', label: 'Lubricacion' },
  { value: 'electrico', label: 'Electrico' },
  { value: 'instrumentacion', label: 'Instrumentacion' },
]

const numberFromInput = (input: HTMLInputElement, fallback: number) => {
  const value = input.valueAsNumber
  if (Number.isFinite(value)) return value
  const parsed = Number(input.value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function ObjectInspector() {
  const selectedId = useSceneStore((state) => state.selectedObjectId)
  const asset = useSceneStore((state) => state.objects.find((object) => object.id === selectedId))
  const update = useSceneStore((state) => state.updateObject)
  const focus = useSceneStore((state) => state.focusObject)

  if (!asset) {
    return (
      <aside className="panel inspector empty">
        <div className="panel-title">Inspector</div>
        <div className="empty-state">
          <span>--</span>
          <strong>Sin seleccion</strong>
          <p>Selecciona un activo en la escena para editar sus propiedades.</p>
        </div>
      </aside>
    )
  }

  const patch = (value: Partial<IndustrialAsset>) => update(asset.id, value)
  const vector = (group: NumberGroup, axis: 'x' | 'y' | 'z', value: number) => patch({ [group]: { ...asset[group], [axis]: value } })
  const size = (key: SizeKey, value: number) => {
    const nextSize = { ...asset.size, [key]: Math.max(0.05, value) }
    patch({ size: nextSize, position: { ...asset.position, y: nextSize.height / 2 } })
  }
  const dataSource = (key: DataKey, value: string) => patch({ dataSources: { ...asset.dataSources, [key]: value } })

  return (
    <aside className="panel inspector">
      <div className="panel-title"><span>Inspector</span><span className={`criticality-badge level-${asset.criticality || 'none'}`}>Criticidad {asset.criticality || '-'}</span></div>
      <div className="inspector-scroll">
        <Section title="Identidad">
          <div className="inspector-actions">
            <button onClick={() => { void navigator.clipboard?.writeText(asset.id).catch(() => undefined) }}>Copiar ID</button>
            <button onClick={() => focus(asset.id)}>Centrar camara</button>
          </div>
          <Field label="ID"><input value={asset.id} onChange={(e) => patch({ id: e.target.value })} /></Field>
          <Field label="Nombre"><input value={asset.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
          <Field label="Tipo"><select value={asset.type} onChange={(e) => patch({ type: e.target.value as IndustrialAsset['type'] })}>{assetTypes.map((type) => <option key={type} value={type}>{labels[type]}</option>)}</select></Field>
          <Field label="Area"><input value={asset.area} onChange={(e) => patch({ area: e.target.value })} placeholder="Ej: Tren acabador" /></Field>
          <Field label="Sistema">
            <select value={asset.system} onChange={(e) => patch({ system: e.target.value as PlantSystem })}>
              {systemOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <div className="two-columns">
            <Field label="Color manual"><input className="color-input" type="color" value={asset.color} onChange={(e) => patch({ color: e.target.value })} /></Field>
            <Field label="Criticidad"><select value={asset.criticality} onChange={(e) => patch({ criticality: e.target.value as Criticality })}><option value="">-</option><option>A</option><option>B</option><option>C</option><option>D</option></select></Field>
          </div>
        </Section>

        <Section title="Geometria">
          <div className="field-label">Dimensiones</div>
          <div className="vector-grid">{(['width', 'height', 'depth'] as SizeKey[]).map((key, i) => <label key={key}><span>{['AN', 'AL', 'PR'][i]}</span><input type="number" step="0.1" min="0.05" value={asset.size[key]} onChange={(e) => size(key, numberFromInput(e.currentTarget, asset.size[key]))} /></label>)}</div>
        </Section>

        <Section title="Ubicacion">
          <VectorEditor label="Posicion (X ancho, Y altura, Z largo)" values={asset.position} onChange={(axis, value) => vector('position', axis, value)} />
          <VectorEditor label="Rotacion (rad)" values={asset.rotation} step={0.1} onChange={(axis, value) => vector('rotation', axis, value)} />
        </Section>

        <Section title="Datos externos">
          {([['plcTag', 'PLC tag'], ['sapEquipmentId', 'SAP equipment ID'], ['grafanaUrl', 'Grafana URL'], ['powerBiUrl', 'Power BI URL'], ['documentsUrl', 'Documentos URL'], ['photosUrl', 'Fotos URL'], ['failureHistory', 'Historial de fallas']] as Array<[DataKey, string]>).map(([key, label]) => <Field key={key} label={label}><input value={asset.dataSources[key]} onChange={(e) => dataSource(key, e.target.value)} placeholder="Sin conectar" /></Field>)}
        </Section>

        <Section title="Notas">
          <Field label="Tags (separados por coma)"><input value={asset.tags.join(', ')} onChange={(e) => patch({ tags: e.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) })} /></Field>
          <Field label="Descripcion"><textarea rows={4} value={asset.description} onChange={(e) => patch({ description: e.target.value })} /></Field>
        </Section>
      </div>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) { return <section className="inspector-section"><h3>{title}</h3>{children}</section> }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
function VectorEditor({ label, values, step = 0.1, onChange }: { label: string; values: IndustrialAsset['position']; step?: number; onChange: (axis: 'x' | 'y' | 'z', value: number) => void }) {
  return <div className="vector-editor"><div className="field-label">{label}</div><div className="vector-grid">{(['x', 'y', 'z'] as const).map((axis) => <label key={axis}><span>{axis.toUpperCase()}</span><input type="number" step={step} value={values[axis]} onChange={(e) => onChange(axis, numberFromInput(e.currentTarget, values[axis]))} /></label>)}</div></div>
}
