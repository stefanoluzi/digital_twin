import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  root: 'lco-standalone',
  base: './',
  publicDir: 'public',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
  },
  build: {
    outDir: '../dist-lco',
    emptyOutDir: true,
  },
})
