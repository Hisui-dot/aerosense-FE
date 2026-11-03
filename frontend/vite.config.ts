import { defineConfig } from 'vite'
import path from 'path'
import net from 'net'
import { spawn } from 'child_process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function autoStartBackend() {
  let backendProcess: ReturnType<typeof spawn> | null = null

  const ensureBackend = () => {
    const socket = new net.Socket()
    socket.setTimeout(600)
    socket.once('connect', () => {
      socket.destroy()
    })
    socket.once('error', () => {
      socket.destroy()
      if (backendProcess) return
      const serverPath = path.resolve(__dirname, '../backend/server.js')
      backendProcess = spawn(process.execPath, [serverPath], {
        cwd: path.resolve(__dirname, '../backend'),
        stdio: 'inherit',
      })
      backendProcess.on('exit', () => {
        backendProcess = null
      })
    })
    socket.connect(8001, '127.0.0.1')
  }

  return {
    name: 'auto-start-backend',
    configureServer() {
      ensureBackend()
    },
  }
}

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    autoStartBackend(),
    figmaAssetResolver(),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
      manifest: {
        name: 'AeroSense Security',
        short_name: 'AeroSense',
        description: 'AeroSense Vape Detection System',
        theme_color: '#0B1847',
        background_color: '#EEF2FE',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
})

