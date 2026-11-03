import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Per far provare il sito a un amico attraverso un tunnel temporaneo (cloudflared)
    allowedHosts: ['.trycloudflare.com'],
  },
  test: {
    include: ['src/**/*.test.ts', 'netlify/**/*.test.ts'],
  },
})
