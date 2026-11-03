import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // App installabile (icona sulla schermata Home) e file del sito salvati sul telefono
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Interrogazioni di Classe',
        short_name: 'Interrogazioni',
        description: "L'ordine delle interrogazioni della tua classe",
        lang: 'it',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#2f5bd3',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: '/index.html',
        // Le pagine interne di Firebase (login) non vanno servite dalla cache
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        // Librerie in file separati: quando cambia il sito, i telefoni riscaricano solo il nostro codice
        codeSplitting: {
          groups: [
            { name: 'firebase', test: /node_modules[\\/](@firebase|firebase)[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
          ],
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
  server: {
    // Per far provare il sito a un amico attraverso un tunnel temporaneo (cloudflared)
    allowedHosts: ['.trycloudflare.com'],
  },
  test: {
    include: ['src/**/*.test.ts', 'netlify/**/*.test.ts'],
  },
})
