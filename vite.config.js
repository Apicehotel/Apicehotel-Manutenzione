import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_REF || 'dev'
const buildTimestamp = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA ? new Date().toISOString() : null

export default defineConfig({
  plugins: [react()],
  define: {
    __RANDAPP_BUILD__: JSON.stringify({ sha: String(buildSha).slice(0, 12), timestamp: buildTimestamp }),
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'supabase-vendor'
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor'
        },
      },
    },
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    hmr: { clientPort: 443, protocol: 'wss' },
  },
  preview: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: true,
  },
})
