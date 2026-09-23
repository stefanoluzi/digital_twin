import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: 'lco-standalone',
  base: './',
  publicDir: 'public',
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: { '/api': 'http://127.0.0.1:3001' },
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
