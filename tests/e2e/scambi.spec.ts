import { expect, test, type Page } from '@playwright/test'
import { accedi, conferma, leggiCodice, svuotaEmulatori } from './aiuti'

test.beforeEach(async () => {
  await svuotaEmulatori()
})

function dataOraLocale(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}

/** Nomi nell'ordine della lista. */
async function ordine(page: Page): Promise<string[]> {
  const righe = page.getByRole('list', { name: 'Ordine delle interrogazioni' }).getByRole('listitem')
  await expect(righe).toHaveCount(3)
  const testi = await righe.allTextContents()
  return testi.map((t) => ['Anna Verdi', 'Bruno Neri', 'Carla Blu'].find((n) => t.includes(n))!)
}

test('scambio di posto tra due compagni', async ({ browser }, info) => {
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('4ªB')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const classe = new URL(anna.url()).pathname
  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()
  const carla = await accedi(browser, 'carla.blu@studenti.ittsrimini.edu.it', 'Carla Blu', `/unisciti/${codice}`)
  await carla.getByRole('button', { name: 'Entra', exact: true }).click()

  // Storia con un'interrogazione; Anna chiude le preferenze e genera la lista
  await anna.goto(`${classe}/configura`)
  await anna.getByLabel('Nome', { exact: true }).fill('Storia')
  await anna.getByRole('group', { name: 'Giorni di lezione' }).getByRole('button', { name: 'martedì' }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await expect(anna.getByRole('link', { name: 'Storia' })).toBeVisible()
  await anna.goto(classe)
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Orale')
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('1')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale' })).toBeVisible()
  const pagina = anna.url()
  await anna.getByRole('button', { name: 'Modifica' }).click()
  await anna.getByLabel('Scadenza per le preferenze').fill(dataOraLocale(new Date(Date.now() - 60_000)))
  await anna.getByRole('button', { name: 'Salva modifiche' }).click()
  await anna.getByRole('button', { name: 'Genera lista' }).click()
  await conferma(anna, 'Genera lista')
  const prima = await ordine(anna)
  const posBruno = prima.indexOf('Bruno Neri') + 1
  const posCarla = prima.indexOf('Carla Blu') + 1

  // Bruno chiede lo scambio a Carla
  await bruno.goto(pagina)
  await expect(bruno.getByText(`Sei il n° ${posBruno} di 3`)).toBeVisible()
  await expect(bruno.getByRole('button', { name: 'Chiedi scambio a Bruno Neri' })).toHaveCount(0) // non con sé stessi
  await bruno.getByRole('button', { name: 'Chiedi scambio a Carla Blu' }).click()
  await conferma(bruno, 'Chiedi lo scambio')
  await expect(bruno.getByText(`Hai chiesto il n° ${posCarla} a`)).toBeVisible()
  await expect(bruno.getByRole('link', { name: 'Avvisa su WhatsApp' })).toHaveAttribute('href', /Ciao%20Carla/)
  await expect(bruno.getByRole('listitem').filter({ hasText: 'Carla Blu' }).getByText('richiesta inviata')).toBeVisible()
  // Anna (non coinvolta) non vede la richiesta di Bruno nella sua lista
  await expect(anna.getByText(/vorrebbe scambiare/)).toHaveCount(0)

  // Carla la trova nella pagina iniziale, in "Da fare"
  await carla.goto('/')
  const daFare = carla.getByRole('list', { name: 'Da fare' })
  await expect(daFare.getByText('Un compagno ti chiede uno scambio di posto: rispondi')).toBeVisible()
  await carla.screenshot({ path: info.outputPath('home-scambio.png'), fullPage: true })
  await daFare.getByRole('link').first().click()
  await expect(carla.getByText('vorrebbe scambiare il posto con te')).toBeVisible()
  await carla.screenshot({ path: info.outputPath('richiesta.png'), fullPage: true })
  await carla.getByRole('button', { name: 'Accetta', exact: true }).click()
  await conferma(carla, 'Accetta lo scambio')

  // La lista cambia per tutti, in tempo reale
  await expect(carla.getByText(`Sei il n° ${posBruno} di 3`)).toBeVisible()
  await expect(bruno.getByText(`Sei il n° ${posCarla} di 3`)).toBeVisible()
  await expect(bruno.getByText('ha accettato lo scambio')).toBeVisible()
  const dopo = await ordine(anna)
  expect(dopo[posBruno - 1]).toBe('Carla Blu')
  expect(dopo[posCarla - 1]).toBe('Bruno Neri')
  await anna.getByText(/Storico delle modifiche/).click()
  await expect(
    anna.getByRole('list', { name: 'Storico delle modifiche' }).getByText(
      `Bruno Neri e Carla Blu si sono scambiati di posto (n° ${posBruno} ↔ n° ${posCarla})`,
    ),
  ).toBeVisible()
  await expect(carla.getByRole('list', { name: 'Da fare' })).toHaveCount(0)

  // Anna rifiuta in automatico: nessuno può più chiederle uno scambio
  await anna.goto(classe)
  await anna.getByRole('switch', { name: /Rifiuta in automatico gli scambi/ }).check()
  await expect(bruno.getByRole('button', { name: 'Chiedi scambio a Carla Blu' })).toBeVisible()
  await expect(bruno.getByRole('button', { name: 'Chiedi scambio a Anna Verdi' })).toHaveCount(0)
  await bruno.screenshot({ path: info.outputPath('lista-scambi.png'), fullPage: true })
})
