import { defineConfig } from 'vitest/config'

// Test delle regole di Firestore: girano contro l'emulatore
// (npm run test:regole lo avvia e lo chiude da solo).
export default defineConfig({
  test: {
    include: ['tests/regole/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 15000,
    hookTimeout: 30000,
  },
})
