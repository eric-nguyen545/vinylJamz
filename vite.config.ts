import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { buildCsp } from './src/lib/csp'

/** Adds the CSP meta tag to the built index.html only (dev needs inline scripts for hot reload). */
const csp = (enabled: boolean): Plugin => ({
  name: 'vinyl-archive-csp',
  apply: 'build',
  transformIndexHtml: (html) => (enabled ? html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${buildCsp()}" />`) : html),
})

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: env.VITE_APP_BASE_PATH || '/',
    plugins: [react(), tailwindcss(), csp(env.VITE_ENABLE_CSP === 'true')],
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Stable vendor chunks cache well between deploys and keep the app chunk small.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined
            if (id.includes('/firebase/') || id.includes('/@firebase/')) return 'firebase'
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/react-router') || id.includes('/scheduler/')) return 'react'
            return undefined
          },
        },
      },
    },
  }
})
