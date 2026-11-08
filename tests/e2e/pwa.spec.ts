import { expect, test } from '@playwright/test'
import { accedi, svuotaEmulatori } from './aiuti'

test.beforeEach(async () => {
  await svuotaEmulatori()
})

test('installabile: manifest, icone e service worker', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await request.get(href!)).json()
  expect(manifest).toMatchObject({ name: 'WhosNext', display: 'standalone', lang: 'it', start_url: '/' })
  for (const icona of manifest.icons as { src: string }[]) {
    const r = await request.get(`/${icona.src}`)
    expect(r.status(), icona.src).toBe(200)
    expect(r.headers()['content-type']).toContain('image/png')
  }
  expect((await request.get('/apple-touch-icon.png')).status()).toBe(200)
  // il service worker si attiva
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.ready).active), { timeout: 20_000 }).toBe(true)
})

test('si apre anche senza connessione, con gli ultimi dati', async ({ browser }, info) => {
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi', '/', { invitoInstalla: true })
  await anna.getByLabel('Nome della classe').fill('4ªB offline')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  await expect(anna.getByRole('heading', { name: '4ªB offline' })).toBeVisible()
  await anna.goto('/')
  await expect(anna.getByRole('main').getByRole('link', { name: /4ªB offline/ })).toBeVisible()
  await expect.poll(() => anna.evaluate(async () => !!(await navigator.serviceWorker.ready).active), { timeout: 20_000 }).toBe(true)

  // "Installa l'app": solo da cellulare, in basso dopo qualche secondo; con un tocco su Android
  await anna.evaluate(() => {
    const e = new Event('beforeinstallprompt') as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
    e.prompt = async () => {}
    e.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(e)
  })
  const invito = anna.getByRole('region', { name: "Installa l'app" })
  if (info.project.name === 'telefono') {
    await expect(invito).toBeVisible()
    await expect(invito.getByText('Funziona anche senza rete')).toBeVisible()
    await expect(invito.getByRole('button', { name: 'Installa' })).toBeVisible()
    await anna.screenshot({ path: info.outputPath('installa.png') })
    await invito.getByRole('button', { name: 'Non ora' }).click()
    await expect(invito).toHaveCount(0)
    await anna.reload()
    await anna.waitForTimeout(5_000)
    await expect(invito).toHaveCount(0) // rimandato di una settimana
  } else {
    await anna.waitForTimeout(5_000)
    await expect(invito).toHaveCount(0) // dal computer no
  }

  // Senza connessione: la pagina arriva dalla cache e la classe dai dati salvati sul dispositivo
  await anna.context().setOffline(true)
  await anna.reload()
  await expect(anna.getByRole('main').getByRole('link', { name: /4ªB offline/ })).toBeVisible({ timeout: 20_000 })
  await anna.context().setOffline(false)
})

// Le notifiche push non si provano qui: Chrome senza finestra nega sempre il permesso.
// La logica del service worker (dati della push, link sicuri) è in sw/notifica.test.ts.
