import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: 'planner-standalone',
  base: './',
  publicDir: 'public',
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5175,
  },
  preview: {
    host: '127.0.0.1',
    port: 4175,
  },
  build: {
    outDir: '../dist-planner',
    emptyOutDir: true,
  },
})
