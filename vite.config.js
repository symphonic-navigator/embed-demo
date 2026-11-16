import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the project at /embed-demo/ (as does `vite preview`);
// the dev server uses /.
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/embed-demo/' : '/',
  plugins: [react()],
  worker: { format: 'es' },
  test: { environment: 'node' },
}))
