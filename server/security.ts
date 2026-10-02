import type { RequestHandler } from 'express'
import { ApiError } from './errors'

// Same-origin assets only; inline styles are required by React/Three.js/Recharts.
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; frame-src 'self' blob: data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  })
  next()
}
export const sameOriginWrites: RequestHandler = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  if (req.headers['sec-fetch-site'] === 'cross-site') return next(new ApiError(403, 'Origen no permitido'))
  if (req.headers.origin) {
    try {
      const origin = new URL(req.headers.origin)
      if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host) throw new Error()
    } catch { return next(new ApiError(403, 'Origen no permitido')) }
  }
  // No browser simple form requests. API clients without Origin remain supported.
  if (req.headers['content-length'] !== '0' && req.method !== 'DELETE' && !req.is('application/json')) return next(new ApiError(415, 'Se requiere application/json'))
  next()
}
