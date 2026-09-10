import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The repository also contains independent HTML entry points and portable
  // build outputs. Only scan the mother application's entry during dev.
  optimizeDeps: { entries: ['index.html'] },
})
