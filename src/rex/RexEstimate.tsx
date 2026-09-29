import { useState, type ReactNode } from 'react'
import { BusyButton } from '../shared/ux/LoadingFeedback'
import { calculateEstimate, formatDecimal, type Estimate, type EstimateConfig, type EstimateInputs } from './estimation'
import type { Save } from './RexForms'

const Field = ({ label, children }: { label: string; children: ReactNode }) => <label className="rex-field"><span>{label}</span>{children}</label>
export const blankEstimate: EstimateInputs = { durationDays: '', mechanical: '0', electrical: '0', mro: '0', services: '0', ownLabor: '0' }
export function EstimateSummary({ value }: { value: Estimate }) {
  const money = (v: string) => `${value.currency} ${formatDecimal(v, 2)}`
  return <div className="rex-estimate-summary" aria-live="polite">
    <div className="rex-estimate-metrics">
      <div><span>Total terceros</span><strong>{formatDecimal(value.people)} personas</strong></div>
      <div><span>Horas por jornada</span><strong>{formatDecimal(value.hoursPerDay)} h/día</strong></div>
      <div><span>Horas por persona</span><strong>{formatDecimal(value.hoursPerPerson)} h</strong></div>
      <div><span>Horas hombre estimadas</span><strong>{formatDecimal(value.manHours)} HH</strong></div>
    </div>
    <p className="rex-muted">{formatDecimal(value.durationDays)} días × {formatDecimal(value.hoursPerDay)} h/día × {formatDecimal(value.people)} personas = {formatDecimal(value.manHours)} HH</p>
    <div className="rex-estimate-total"><span>Costo estimado de intervención</span><strong>{money(value.total)}</strong></div>
    <dl className="rex-estimate-breakdown"><div><dt>MRO / materiales y repuestos</dt><dd>{money(value.mro)}</dd></div><div><dt>Mano de obra terceros (MOA)</dt><dd>{money(value.contractorLabor)}</dd></div><div><dt>Servicios adicionales</dt><dd>{money(value.services)}</dd></div><div><dt>Labor propia</dt><dd>{money(value.ownLabor)}</dd></div></dl>
    <p className="rex-muted">Mano de obra: {formatDecimal(value.manHours)} HH × {value.currency} {formatDecimal(value.hourlyRate)}/h = {money(value.contractorLabor)}.</p>
  </div>
}
export function LegacyResources({ values }: { values: Record<string, string> }) {
  if (!Object.keys(values).length) return null
  return <details><summary>Valores anteriores / legacy (sin recalcular)</summary><p className="rex-muted">Se conservan como fueron registrados. No se suman a la estimación nueva ni se convierten automáticamente.</p><dl className="rex-estimate-breakdown">{Object.entries(values).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || '—'}</dd></div>)}</dl></details>
}
export function EstimateEditor({ value, config, saved, changed, onChange, onReestimate, legacy }: { value: EstimateInputs; config: EstimateConfig; saved?: Estimate; changed: boolean; onChange: (next: EstimateInputs) => void; onReestimate: () => void; legacy: Record<string, string> }) {
  let preview: Estimate | undefined; let error = ''
  const parameters = !changed && saved ? saved : config
  if (value.durationDays.trim()) { try { preview = calculateEstimate(value, parameters) } catch (e) { error = (e as Error).message } }
  const different = saved && (saved.hourlyRate !== config.hourlyRate || saved.hoursPerDay !== config.hoursPerDay || saved.currency !== config.currency)
  return <details className="rex-estimator" open><summary>Recursos y costos</summary><p className="rex-muted">Estimación opcional. Ingresá duración, personas y costos adicionales; los resultados se calculan automáticamente.</p>
    {saved && <div className="rex-estimate-context">{changed ? 'Nueva estimación con configuración vigente. La versión anterior se conserva.' : `Estimación guardada: ${saved.currency} ${formatDecimal(saved.hourlyRate)}/h · jornada ${formatDecimal(saved.hoursPerDay)} h.`}{!changed && different && <><p>La configuración vigente es diferente. Editar estos recursos o reestimar utiliza la nueva tarifa y moneda, sin convertir importes automáticamente.</p><button type="button" onClick={onReestimate}>Reestimar con configuración vigente</button></>}</div>}
    <h3>Recursos</h3><div className="rex-form-grid">{([['durationDays', 'Duración estimada (días)', 'decimal'], ['mechanical', 'Terceros MEC (personas)', 'numeric'], ['electrical', 'Terceros ELE (personas)', 'numeric']] as const).map(([key, label, mode]) => <Field key={key} label={label}><input inputMode={mode} required={changed} value={value[key]} placeholder={key === 'durationDays' ? 'Ej. 2,5' : '0'} onChange={(e) => onChange({ ...value, [key]: e.target.value })} /></Field>)}</div>
    <h3>Costos adicionales · {parameters.currency}</h3><p className="rex-muted">Ingresá importes en la moneda indicada. Servicios excluye la mano de obra calculada arriba; labor propia corresponde únicamente al personal interno. No hay conversión de moneda.</p><div className="rex-form-grid">{([['mro', 'MRO / materiales y repuestos'], ['services', 'Servicios adicionales'], ['ownLabor', 'Labor propia']] as const).map(([key, label]) => <Field key={key} label={label}><input inputMode="decimal" required={changed} value={value[key]} onChange={(e) => onChange({ ...value, [key]: e.target.value })} /></Field>)}</div>
    {preview ? <EstimateSummary value={preview} /> : <p className="rex-muted">{error || (config.hourlyRate === null ? 'Definí el valor hora hombre en Configuración REX para calcular costos.' : 'Ingresá la duración para ver el cálculo. Usá coma o punto decimal, sin separadores de miles.')}</p>}
    <LegacyResources values={legacy} />
  </details>
}
export function RexConfigForm({ config, busy, save }: { config: EstimateConfig; busy: boolean; save: Save }) {
  const [draft, set] = useState({ hoursPerDay: config.hoursPerDay, hourlyRate: config.hourlyRate ?? '', currency: config.currency })
  return <form onSubmit={(e) => { e.preventDefault(); void save('/config', draft, 'PUT') }}><fieldset disabled={busy}><p>Estos parámetros se utilizan para nuevas estimaciones e intervenciones. No modifican los costos ya guardados.</p><div className="rex-form-grid">
    <Field label="Horas por jornada (h/día)"><input required inputMode="decimal" value={draft.hoursPerDay} onChange={(e) => set({ ...draft, hoursPerDay: e.target.value })} /></Field>
    <Field label="Valor hora hombre terceros"><input required inputMode="decimal" placeholder="Ej. 25" value={draft.hourlyRate} onChange={(e) => set({ ...draft, hourlyRate: e.target.value })} /></Field>
    <Field label="Moneda"><input required maxLength={3} pattern="[A-Za-z]{3}" value={draft.currency} onChange={(e) => set({ ...draft, currency: e.target.value.toUpperCase() })} /></Field>
    </div><p className="rex-muted">El valor de la hora debe definirse explícitamente. Los costos se redondean a dos decimales al calcular la mano de obra; el total suma ese importe y los costos adicionales.</p></fieldset><footer><BusyButton busy={busy} type="submit" className="primary">Guardar configuración REX</BusyButton></footer></form>
}
