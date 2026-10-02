import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

export function localPdfAssets(): Plugin {
  const assets = new Map<string, Buffer>()
  for (const folder of ['cmaps', 'standard_fonts', 'wasm']) {
    const root = resolve('node_modules/pdfjs-dist', folder)
    for (const name of readdirSync(root, { withFileTypes: true })) {
      if (name.isFile()) assets.set(`pdfjs/${folder}/${name.name}`, readFileSync(resolve(root, name.name)))
    }
  }
  return {
    name: 'local-pdf-assets',
    generateBundle() { for (const [fileName, source] of assets) this.emitFile({ type: 'asset', fileName, source }) },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const key = (req.url || '').split('?')[0].replace(/^\//, '')
        const asset = assets.get(key)
        if (!asset) return next()
        res.setHeader('Content-Type', key.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream')
        res.end(asset)
      })
    },
  }
}
