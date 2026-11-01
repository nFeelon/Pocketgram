import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

// Cloud Phone security docs recommend a CSP. GitHub Pages can't set headers → meta tag instead.
// Injected only into production builds — the dev server needs eval/inline scripts for HMR.
// connect-src stays broad on purpose: mtcute dials rotating *.web.telegram.org DC endpoints over wss.
const CSP =
  "default-src 'self'; " +
  "script-src 'self' 'wasm-unsafe-eval'; " + // mtcute crypto is WASM — wasm-unsafe-eval, no eval
  "style-src 'self' 'unsafe-inline'; " +     // React inline style attrs (avatar colors)
  "img-src 'self' data: blob:; " +
  "media-src blob:; " +
  "font-src 'self'; " +
  "connect-src 'self' https: wss:; " +
  "worker-src 'self' blob:; " +
  "manifest-src 'self'; " +
  "object-src 'none'; base-uri 'none'; upgrade-insecure-requests"

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: './', // Needed for GitHub Pages
  build: {
    assetsInlineLimit: 8192,
  },
  plugins: [
    svgr(),
    react(),
    command === 'build' && {
      name: 'inject-csp',
      transformIndexHtml: (html: string) =>
        html.replace(
          '<head>',
          `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
        ),
    },
  ],
  optimizeDeps: {
    // @mtcute/wasm ships its own .wasm which vite pre-bundling breaks
    exclude: ['@mtcute/wasm'],
  },
  test: {
    // reference repos (dumbtalk-main, cloudphone-types-main) ship their own
    // test suites — ours lives in src/ only
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
