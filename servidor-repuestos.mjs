import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = fileURLToPath(new URL('.', import.meta.url))
const host = '127.0.0.1'
const port = 4176
const mimeTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon', '.pdf':'application/pdf' }

const server = createServer(async (request, response) => {
  try {
    const requested = decodeURIComponent(new URL(request.url ?? '/', `http://${host}:${port}`).pathname)
    const relativePath = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '')
    const resolved = normalize(join(root, relativePath))
    if (!resolved.startsWith(normalize(root))) throw new Error('Ruta no permitida')
    const info = await stat(resolved); const filePath = info.isDirectory() ? join(resolved, 'index.html') : resolved
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath).toLowerCase()] ?? 'application/octet-stream', 'Cache-Control':'no-cache' }); response.end(await readFile(filePath))
  } catch { try { response.writeHead(200, { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-cache' }); response.end(await readFile(join(root, 'index.html'))) } catch { response.writeHead(404); response.end('Archivo no encontrado') } }
})

server.listen(port, host, () => { const url = `http://${host}:${port}/`; console.log(`Repuestos Criticos disponible en ${url}`); console.log('Mantenga esta ventana abierta. Presione Ctrl+C para detener la aplicacion.'); if (process.platform === 'win32' && process.env.SPARES_NO_BROWSER !== '1') spawn('cmd',['/c','start','',url],{detached:true,stdio:'ignore',windowsHide:true}).unref() })
