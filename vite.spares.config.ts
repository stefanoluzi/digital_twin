import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'spares-standalone',
  base: './',
  publicDir: 'public',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5176 },
  preview: { host: '127.0.0.1', port: 4176 },
  build: { outDir: '../dist-spares', emptyOutDir: true },
})
