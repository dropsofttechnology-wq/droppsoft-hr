import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isAndroid = mode === 'android'
  return {
    /** Relative paths required for Capacitor WebView asset loading */
    base: isAndroid ? './' : '/',
    plugins: [react()],
    test: {
      globals: true,
      environment: 'node'
    },
    server: {
      port: 3000,
      open: true
    },
    build: {
      outDir: 'dist',
      sourcemap: false, // Disable to reduce memory during build (helps on low-RAM machines)
      // Android: do not esbuild-minify. html5-qrcode embeds a large ZXing UMD bundle; minify has been observed to break QR scanning in release WebView while dev (unminified) works. Desktop build stays unminified for low-RAM pack machines.
      minify: false,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Only split very large, mostly lazy-loaded libs. Splitting react into its own chunk
            // while dumping "everything else" into vendor caused vendor↔react circular chunks and a blank Electron UI.
            if (id.includes('node_modules')) {
              if (id.includes('jspdf')) return 'jspdf'
              if (id.includes('face-api') || id.includes('@vladmandic')) return 'face-api'
            }
            return undefined
          }
        }
      },
      chunkSizeWarningLimit: 600
    }
  }
})
