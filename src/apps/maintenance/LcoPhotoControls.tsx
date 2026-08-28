import { useEffect, useState, type ChangeEvent } from 'react'
import type { LcoPhotoAttachment } from '../../maintenance/domain/lcoCouplings'
import { processLcoPhotoFiles } from '../../services/lcoPhotoService'

export function LcoPhotoPicker({ photos, onChange, label = 'Agregar fotos', compact = false }: { photos: LcoPhotoAttachment[]; onChange: (photos: LcoPhotoAttachment[]) => void; label?: string; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  const addFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return
    setBusy(true)
    try { onChange([...photos, ...await processLcoPhotoFiles(files)]) } finally { setBusy(false) }
  }
  return <section className={`lco-photo-picker ${compact ? 'compact' : ''}`}>
    <label className="lco-photo-add">📷 {busy ? 'Procesando…' : label}{photos.length ? ` · ${photos.length}` : ''}<input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={addFiles} /></label>
    {photos.length > 0 && <div className="lco-photo-thumbnails">{photos.map((photo) => <article key={photo.id}><img src={photo.dataUrl} alt={photo.caption || photo.fileName} /><div><span title={photo.fileName}>{photo.fileName}</span>{!compact && <input value={photo.caption} onChange={(event) => onChange(photos.map((item) => item.id === photo.id ? { ...item, caption: event.target.value } : item))} placeholder="Descripción opcional" />}</div><button aria-label={`Quitar ${photo.fileName}`} onClick={() => onChange(photos.filter((item) => item.id !== photo.id))}>×</button></article>)}</div>}
  </section>
}

export function LcoPhotoLightbox({ photos, initialIndex = 0, onClose }: { photos: LcoPhotoAttachment[]; initialIndex?: number; onClose: () => void }) {
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(0, photos.length - 1)))
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') setIndex((current) => (current - 1 + photos.length) % photos.length)
      if (event.key === 'ArrowRight') setIndex((current) => (current + 1) % photos.length)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [onClose, photos.length])
  const photo = photos[index]
  if (!photo) return null
  return <div className="lco-lightbox" role="dialog" aria-modal="true" aria-label="Galería de fotografías"><header><div><strong>{photo.caption || photo.fileName}</strong><small>{index + 1} de {photos.length}</small></div><button aria-label="Cerrar galería" onClick={onClose}>×</button></header><div className="lco-lightbox-stage"><button aria-label="Foto anterior" onClick={() => setIndex((index - 1 + photos.length) % photos.length)}>‹</button><img src={photo.dataUrl} alt={photo.caption || photo.fileName} /><button aria-label="Foto siguiente" onClick={() => setIndex((index + 1) % photos.length)}>›</button></div></div>
}
