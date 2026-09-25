import { useState } from 'react'
import { legacyQuantity } from './domain'
export function RepairImport({ busy, onImport }: { busy: boolean; onImport: (body: unknown) => Promise<boolean> }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')
  const [approved, setApproved] = useState(false)
  const [complete, setComplete] = useState(false)
  return <div className="repairs-note"><p>Prepará el Excel con scripts/prepare-repairs-import.py y completá áreas y años en el JSON (día exacto opcional) de revisión. La importación crea necesidades planificadas; no inventa estados ni entregas.</p><input type="file" accept=".json,application/json" aria-label="Lote legacy revisado" disabled={busy} onChange={async (event) => {
    setRows([]); setError(''); setApproved(false); setComplete(false)
    const file = event.target.files?.[0]; if (!file) return
    try { const body = JSON.parse(await file.text()); if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 1000) throw new Error('El archivo debe contener entre 1 y 1000 filas'); for (const row of body.rows) { if (!row.area || !row.targetMonth || !row.idrep || !legacyQuantity(row.quantity)) throw new Error('Faltan áreas, años o cantidades por confirmar'); } setRows(body.rows) } catch (e) { setError((e as Error).message) }
  }} />{error && <p role="alert">{error}</p>}{rows.length > 0 && <><p>{rows.length} necesidades · {rows.reduce((n, r) => n + (legacyQuantity(r.quantity) || 0), 0)} unidades.</p><div className="table-scroll"><table><thead><tr><th>IDREP</th><th>Área</th><th>Cantidad</th><th>Mes</th><th>Necesidad</th></tr></thead><tbody>{rows.slice(0, 20).map((row, i) => <tr key={i}>{['idrep', 'area', 'quantity', 'targetMonth', 'requiredDate'].map((key) => <td key={key}>{String(row[key])}</td>)}</tr>)}</tbody></table></div><p>Vista previa de las primeras 20 filas. El lote se guarda completo en una única transacción.</p><label className="repairs-check"><input type="checkbox" checked={approved} disabled={busy || complete} onChange={(e) => setApproved(e.target.checked)} />Revisé todo el lote y confirmo áreas, años y fechas.</label><button className="primary" disabled={!approved || busy || complete} onClick={async () => { if (await onImport({ confirmed: true, rows })) setComplete(true) }}>{complete ? 'Lote importado' : 'Importar lote revisado'}</button></>}</div>
}
