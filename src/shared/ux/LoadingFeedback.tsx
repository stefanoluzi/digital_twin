import { useEffect, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import './loadingFeedback.css'

export function Spinner() { return <span className="ux-spinner" aria-hidden="true" /> }

/** Reserve space during refresh without hiding the last confirmed server response. */
export function RefreshStatus({ active, label = 'Actualizando…' }: { active: boolean; label?: string }) {
  return <div className="ux-refresh" role="status" aria-live="polite">{active && <><Spinner />{label}</>}</div>
}

export function BusyButton({ busy = false, busyLabel = 'Guardando…', children, disabled, className = '', style, hidden, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; busyLabel?: string }) {
  return <button type="button" {...props} hidden={hidden} style={{ ...style, display: hidden ? 'none' : 'inline-grid' }} disabled={disabled || busy} aria-busy={busy} className={`ux-button ${className}`}>
    <span className="ux-button-label" style={{ visibility: busy ? 'hidden' : 'visible' }} aria-hidden={busy}>{children}</span>
    <span className="ux-button-label" style={{ visibility: busy ? 'visible' : 'hidden' }} aria-hidden={!busy}><Spinner />{busyLabel}</span>
  </button>
}

/** The ref locks synchronously, including two clicks before React renders. */
export function AsyncButton({ onAction, ...props }: Omit<Parameters<typeof BusyButton>[0], 'onClick' | 'busy'> & { onAction: () => Promise<unknown> }) {
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const execute = async () => {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try { await onAction() }
    catch (error) { window.alert(error instanceof Error ? error.message : 'No se pudo completar la operación. Intentá nuevamente.') }
    finally { pending.current = false; setBusy(false) }
  }
  return <BusyButton {...props} busy={busy} onClick={() => void execute()} />
}

/** Animate the container, not its React key: forms and tables retain their state. */
export function PageTransition({ transitionKey, children, ...props }: HTMLAttributes<HTMLDivElement> & { transitionKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const animation = ref.current?.animate?.([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 180, easing: 'ease-out' })
    return () => animation?.cancel()
  }, [transitionKey])
  return <div ref={ref} {...props}>{children}</div>
}

export function Skeleton({ className = '' }: { className?: string }) { return <div aria-hidden="true" className={`ux-skeleton ${className}`} /> }
export function KpiSkeleton() { return <div className="ux-skeleton-card"><Skeleton /><Skeleton className="ux-skeleton-value" /><Skeleton /></div> }
export function TableSkeleton({ rows = 6 }: { rows?: number }) { return <div className="ux-skeleton-table" aria-hidden="true"><Skeleton className="ux-skeleton-heading" />{Array.from({ length: rows }, (_, index) => <div className="ux-skeleton-row" key={index}>{[0, 1, 2, 3].map((column) => <Skeleton key={column} />)}</div>)}</div> }
export function ListSkeleton() { return <TableSkeleton rows={4} /> }
export function ChartSkeleton({ height = 280 }: { height?: number }) { return <div className="ux-skeleton-chart" style={{ height }} aria-hidden="true">{[45, 65, 50, 80, 60, 75].map((height, index) => <Skeleton key={index} className={`ux-bar ux-bar-${height}`} />)}</div> }
export function DashboardSkeleton({ chart = false }: { chart?: boolean }) { return <div className="ux-skeleton-dashboard"><div className="ux-skeleton-kpis">{[0, 1, 2, 3].map((index) => <KpiSkeleton key={index} />)}</div>{chart ? <ChartSkeleton /> : <TableSkeleton />}</div> }

/** Only the visual feedback is delayed; the request starts immediately. */
export function ModuleLoading({ title = 'Digital Twin · Maintenance Management', chart = false }: { title?: string; chart?: boolean }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { const timer = window.setTimeout(() => setVisible(true), 250); return () => window.clearTimeout(timer) }, [])
  return <section className="ux-module-loading" aria-busy="true" aria-label={`Cargando ${title}`}>
    <div style={{ visibility: visible ? 'visible' : 'hidden' }}><header><strong>{title}</strong><span role="status"><Spinner />Cargando sistema…</span></header><DashboardSkeleton chart={chart} /></div>
  </section>
}
