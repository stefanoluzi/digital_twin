import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: { proxy: { '/api': 'http://127.0.0.1:3001' } },
  plugins: [react(), tailwindcss()],
  // The repository also contains independent HTML entry points and portable
  // build outputs. Only scan the mother application's entry during dev.
  optimizeDeps: { entries: ['index.html'] },
})
