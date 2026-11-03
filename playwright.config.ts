import { defineConfig, devices } from '@playwright/test'

// Test nel browser del percorso completo, contro gli emulatori Firebase.
// npm run test:e2e avvia gli emulatori, il sito in modalità emulatore e i test.
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/riscaldamento.ts',
  fullyParallel: false,
  workers: 1,
  // La finestra di login finta dell'emulatore carica i suoi script da internet (unpkg.com):
  // ogni tanto sono lenti. Un secondo tentativo evita falsi allarmi dovuti alla rete.
  retries: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5180',
    locale: 'it-IT',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'telefono', use: { ...devices['Pixel 7'] } },
  ],
  // Si prova il sito compilato (come in produzione, ma collegato agli emulatori):
  // il server di sviluppo può ricaricare la pagina al primo avvio e disturbare il login.
  webServer: {
    command: 'vite build --mode emulator --outDir dist-emu && vite preview --outDir dist-emu --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
