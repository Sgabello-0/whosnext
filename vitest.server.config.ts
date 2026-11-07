import { defineConfig } from 'vitest/config'

// Test delle funzioni sul server (netlify/) contro l'emulatore di Firestore:
// npm run test:server
export default defineConfig({
  test: {
    include: ['tests/server/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
    // indirizzo finto del sito (quello vero è solo nelle variabili di Netlify)
    env: { URL_SITO: 'https://whosnext.example' },
  },
})
