import { chromium, type FullConfig } from '@playwright/test'

/**
 * Prima dei test fa un login "a vuoto".
 *
 * Il primo login dopo l'avvio dell'emulatore spesso resta appeso: l'iframe dell'emulatore
 * (127.0.0.1:9099/emulator/auth/iframe) scarica https://apis.google.com/js/api.js e quella
 * richiesta, solo la prima volta, nel Chromium automatico non termina. I login successivi
 * funzionano. Questo login di riscaldamento "consuma" il primo tentativo; se fallisce non importa.
 */
export default async function riscaldamento(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL ?? 'http://localhost:5180'
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(baseURL)
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Accedi con Google' }).click(),
    ])
    await popup.waitForLoadState('load', { timeout: 30_000 })
    for (let i = 0; i < 20 && !(await popup.locator('#email-input').isVisible()); i++) {
      await popup.locator('#add-account-button').click()
      await popup.waitForTimeout(250)
    }
    await popup.locator('#email-input').fill('riscaldamento@example.com')
    await Promise.all([
      popup.waitForEvent('close', { timeout: 20_000 }),
      popup.locator('#sign-in').click({ noWaitAfter: true }),
    ])
  } catch {
    console.log('Login di riscaldamento non completato (capita, si prosegue).')
  } finally {
    await browser.close()
  }
}
