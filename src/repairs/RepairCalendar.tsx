import { useEffect, useId, useRef, useState } from 'react'
import { calendarDays, civilDate, fiscalLabel, fiscalMonths, fiscalOptions, fiscalYear, formatRepairDate, monthLabel, systemDay, weekdayLabels } from './calendar'

export function useRepairToday() {
  const [day, setDay] = useState(systemDay)
  useEffect(() => { const update = () => setDay(systemDay()); const timer = window.setInterval(update, 30000); window.addEventListener('focus', update); document.addEventListener('visibilitychange', update); return () => { clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update) } }, [])
  return day
}
export function ExerciseSelector({ year, onChange, today }: { year: number; onChange: (year: number) => void; today: string }) {
  return <div className="exercise-selector"><button type="button" className="ghost" aria-label="Ejercicio anterior" onClick={() => onChange(year - 1)}>‹</button><select aria-label="Ejercicio" value={year} onChange={(e) => onChange(Number(e.target.value))}>{fiscalOptions(fiscalYear(today), year).map((y) => <option key={y} value={y}>{fiscalLabel(y)}</option>)}</select><button type="button" className="ghost" aria-label="Ejercicio siguiente" onClick={() => onChange(year + 1)}>›</button></div>
}
export function RepairMonthSelect({ value, onChange, name, empty = false }: { value: string; onChange: (v: string) => void; name?: string; empty?: boolean }) {
  const year = fiscalYear(value || systemDay())
  return <span className="repair-month-select"><select aria-label="Ejercicio del mes" value={year} onChange={(e) => onChange(`${e.target.value}-07`)}>{fiscalOptions(fiscalYear(), year).map((y) => <option key={y} value={y}>{fiscalLabel(y)}</option>)}</select><select aria-label="Mes objetivo" name={name} value={value} onChange={(e) => onChange(e.target.value)}>{empty && <option value="">Todos los meses</option>}{fiscalMonths(year).map((m) => <option key={m} value={m}>{monthLabel(m, true)}</option>)}</select></span>
}
/** Locale-safe calendar: native date inputs ignore lang on many OS/browser combinations. */
export function RepairDatePicker({ name, value, onChange, initialMonth, required = false, max, min, label = 'Fecha' }: { name?: string; value: string; onChange: (v: string) => void; initialMonth?: string; required?: boolean; max?: string; min?: string; label?: string }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState((value || initialMonth || systemDay()).slice(0, 7))
  const ref = useRef<HTMLSpanElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => { if (!open) return; const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close) }, [open])
  const choose = (v: string) => { onChange(v); setOpen(false); trigger.current?.focus() }
  const move = (delta: number) => { const d = civilDate(`${month}-01`); d.setUTCMonth(d.getUTCMonth() + delta); setMonth(d.toISOString().slice(0, 7)) }
  const grid = calendarDays(month)
  return <span className="repair-datepicker" ref={ref} onKeyDown={(e) => { if (open && e.key === 'Escape') { e.stopPropagation(); setOpen(false); trigger.current?.focus() } }}>
    <input type="hidden" name={name} value={value} />
    <button ref={trigger} className="ghost repair-date-trigger" type="button" aria-label={label} aria-expanded={open} aria-controls={id} onClick={() => { setMonth((value || initialMonth || systemDay()).slice(0, 7)); setOpen(!open) }}>{value ? formatRepairDate(value) : 'DD/MM/AAAA'} <span aria-hidden="true">▦</span></button>
    {open && <span className="repair-calendar" id={id} role="group" aria-label={`Calendario ${label}`}><span className="repair-calendar-heading"><button type="button" aria-label="Mes anterior" onClick={() => move(-1)}>‹</button><strong>{monthLabel(month, true)}</strong><button type="button" aria-label="Mes siguiente" onClick={() => move(1)}>›</button></span><span className="repair-calendar-grid">{weekdayLabels.map((d) => <b key={d}>{d}</b>)}{Array.from({ length: grid.offset }, (_, i) => <span key={`empty-${i}`} />)}{Array.from({ length: grid.count }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; return <button type="button" key={date} aria-label={formatRepairDate(date)} aria-pressed={value === date} className={date === systemDay() ? 'is-today' : ''} disabled={!!(min && date < min || max && date > max)} onClick={() => choose(date)}>{i + 1}</button> })}</span><span className="repairs-actions"><button type="button" disabled={!!(min && systemDay() < min || max && systemDay() > max)} onClick={() => choose(systemDay())}>Hoy</button>{!required && <button type="button" onClick={() => choose('')}>Sin fecha exacta</button>}</span></span>}
  </span>
}
