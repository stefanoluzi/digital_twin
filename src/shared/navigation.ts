import { useEffect, useState } from 'react'

export function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function useAppLocation() {
  const [location, setLocation] = useState(() => `${window.location.pathname}${window.location.search}`)
  useEffect(() => { const sync = () => setLocation(`${window.location.pathname}${window.location.search}`); window.addEventListener('popstate', sync); return () => window.removeEventListener('popstate', sync) }, [])
  return location
}
