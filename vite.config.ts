import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Needed for GitHub Pages
  build: {
    assetsInlineLimit: 8192,
  },
  plugins: [svgr(), react()],
  optimizeDeps: {
    // @mtcute/wasm ships its own .wasm which vite pre-bundling breaks
    exclude: ['@mtcute/wasm'],
  },
})
