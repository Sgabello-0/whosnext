import { expect, type Browser, type Page } from '@playwright/test'

const PROGETTO = 'demo-whosnext'

/** Svuota database e account degli emulatori. */
export async function svuotaEmulatori() {
  await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${PROGETTO}/databases/(default)/documents`, { method: 'DELETE' })
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROGETTO}/accounts`, { method: 'DELETE' })
}

/** Apre una nuova finestra (contesto separato = utente separato) e fa login con un account finto. */
export async function accedi(browser: Browser, email: string, nome: string, percorso = '/'): Promise<Page> {
  // Permesso agli appunti per verificare i testi copiati con "Copia messaggio"
  const contesto = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await contesto.newPage()
  await page.goto(percorso)
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Accedi con Google' }).click(),
  ])
  // Il pulsante risponde solo dopo che lo script della pagina è stato caricato: si riprova finché il modulo compare
  await popup.waitForLoadState('load')
  await expect(async () => {
    await popup.locator('#add-account-button').click()
    await expect(popup.locator('#email-input')).toBeVisible({ timeout: 1000 })
  }).toPass({ timeout: 15_000 })
  await popup.locator('#email-input').fill(email)
  await popup.locator('#display-name-input').fill(nome)
  // In ascolto della chiusura PRIMA del clic: la finestra può chiudersi subito
  await Promise.all([
    popup.waitForEvent('close', { timeout: 30_000 }),
    popup.locator('#sign-in').click({ noWaitAfter: true }),
  ])
  // Login completato: c'è il pulsante "Esci" (account ammesso) o "Esci e cambia account" (non ammesso)
  await expect(page.getByRole('button', { name: /^Esci( e cambia account)?$/ })).toBeVisible({ timeout: 30_000 })
  return page
}

/** Legge il codice d'invito mostrato nella pagina della classe ("ABC-DEF" → "ABCDEF"). */
export async function leggiCodice(page: Page): Promise<string> {
  const testo = await page.getByText(/^[A-Z2-9]{3}-[A-Z2-9]{3}$/).first().textContent()
  expect(testo).toBeTruthy()
  return testo!.replace('-', '')
}

/** Conferma nella finestra del sito (al posto di window.confirm) cliccando il pulsante indicato. */
export async function conferma(page: Page, pulsante: string) {
  const finestra = page.getByRole('dialog')
  await expect(finestra).toBeVisible()
  await finestra.getByRole('button', { name: pulsante, exact: true }).click()
  await expect(finestra).toBeHidden()
}
