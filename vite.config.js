import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the project at /embed-demo/; the dev server uses /.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/embed-demo/' : '/',
  plugins: [react()],
  worker: { format: 'es' },
  test: { environment: 'node' },
}))
