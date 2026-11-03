import { expect, test, type Page } from '@playwright/test'
import { accedi, conferma, leggiCodice, svuotaEmulatori } from './aiuti'

test.beforeEach(async () => {
  await svuotaEmulatori()
})

/** Testi delle prossime lezioni mostrate nella pagina ("Martedì 10/11", …). */
async function prossimeLezioni(page: Page): Promise<string[]> {
  const elenco = page.getByRole('list', { name: 'Prossime lezioni' })
  await expect(elenco.getByRole('listitem').first()).toBeVisible()
  return elenco.getByRole('listitem').allTextContents()
}

test('materie, calendario e interrogazioni', async ({ browser }, info) => {
  // Anna crea la classe; Carla (studente) entra
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('4ªB')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  await expect(anna.getByRole('heading', { name: '4ªB' })).toBeVisible()
  const codice = await leggiCodice(anna)
  const carla = await accedi(browser, 'carla.blu@studenti.ittsrimini.edu.it', 'Carla Blu', `/unisciti/${codice}`)
  await carla.getByRole('button', { name: 'Entra', exact: true }).click()
  await expect(carla.getByText('Il capoclasse non ha ancora aggiunto materie.')).toBeVisible()
  await expect(carla.getByRole('link', { name: 'Materie e calendario' })).toHaveCount(0)

  // Anna aggiunge Matematica (martedì e giovedì)
  await anna.getByRole('link', { name: 'Materie e calendario' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Matematica')
  const giorniNuova = anna.getByRole('group', { name: 'Giorni di lezione' })
  await giorniNuova.getByRole('button', { name: 'martedì' }).click()
  await giorniNuova.getByRole('button', { name: 'giovedì' }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await expect(anna.getByRole('link', { name: 'Matematica' })).toBeVisible()
  await expect(anna.getByText('mar · gio')).toBeVisible()

  // Le prossime lezioni sono solo di martedì e giovedì
  await anna.getByRole('link', { name: 'Matematica' }).click()
  const lezioni = await prossimeLezioni(anna)
  expect(lezioni).toHaveLength(5)
  for (const l of lezioni) expect(l).toMatch(/^(Martedì|Giovedì) \d{2}\/\d{2}$/)

  // Anna annulla la prima lezione: sparisce dall'elenco
  const prima = lezioni[0]!
  const [gg, mm] = prima.split(' ')[1]!.split('/')
  const oggi = new Date()
  let anno = oggi.getFullYear()
  if (Number(mm) < oggi.getMonth() + 1) anno++ // es. oggi dicembre, lezione a gennaio
  await anna.goBack()
  await anna.getByRole('tab', { name: 'Calendario' }).click()
  await anna.getByLabel('Giorno', { exact: true }).fill(`${anno}-${mm}-${gg}`)
  await anna.getByLabel('Cosa succede').selectOption('lezione-annullata')
  await anna.getByRole('button', { name: 'Aggiungi', exact: true }).click()
  await expect(anna.getByText(`${gg}/${mm}/${anno} · Matematica: lezione annullata`)).toBeVisible()
  await anna.getByRole('tab', { name: 'Materie' }).click()
  await anna.getByRole('link', { name: 'Matematica' }).click()
  await expect.poll(() => prossimeLezioni(anna)).not.toContain(prima)

  // Anna crea un'interrogazione con 2 studenti per lezione
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Orale capitolo 3')
  await anna.getByLabel('Descrizione (facoltativa)').fill('Pagine 40-62')
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('2')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale capitolo 3' })).toBeVisible()
  await expect(anna.getByText('Preferenze aperte')).toBeVisible()
  await expect(anna.getByText('2 studenti')).toBeVisible()
  await expect(anna.getByText('Pagine 40-62')).toBeVisible()

  // Carla la vede (in tempo reale) ma non può modificarla
  await expect(carla.getByRole('link', { name: /Orale capitolo 3/ })).toBeVisible()
  await carla.getByRole('link', { name: /Orale capitolo 3/ }).click()
  await expect(carla.getByRole('heading', { name: 'Orale capitolo 3' })).toBeVisible()
  await expect(carla.getByRole('button', { name: 'Modifica' })).toHaveCount(0)
  await carla.screenshot({ path: info.outputPath('interrogazione-studente.png'), fullPage: true })
  await expect(carla.getByText(/^\(tra \d+ ore\)$/)).toBeVisible()

  // Anna la modifica: Carla vede subito il cambiamento
  await anna.getByRole('button', { name: 'Modifica' }).click()
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('')
  await anna.getByRole('button', { name: 'Salva modifiche' }).click()
  await expect(carla.getByText('non indicato')).toBeVisible()

  // Anna aggiunge una vacanza
  await anna.goto(anna.url().split('/materia/')[0] + '/configura?sezione=calendario')
  await anna.getByLabel('Dal', { exact: true }).fill(`${anno + 1}-01-02`)
  await anna.getByLabel('Al (incluso)').fill(`${anno + 1}-01-06`)
  await anna.getByLabel('Descrizione', { exact: true }).fill('Vacanze di Natale')
  await anna.getByRole('button', { name: 'Aggiungi vacanza' }).click()
  await expect(anna.getByText(`Vacanze di Natale: 02/01/${anno + 1} – 06/01/${anno + 1}`)).toBeVisible()
  await anna.screenshot({ path: info.outputPath('configura.png'), fullPage: true })

  // Le vacanze dell'Emilia-Romagna 2026-27 ci sono già; se se ne toglie una si può rimettere
  await expect(anna.getByText('Vacanze di Natale: 24/12/2026 – 06/01/2027')).toBeVisible()
  await expect(anna.getByText('Vacanze di Pasqua: 25/03/2027 – 30/03/2027')).toBeVisible()
  await expect(anna.getByText('Commemorazione dei defunti: 02/11/2026')).toBeVisible()
  await expect(anna.getByText('Vacanze regionali mancanti')).toHaveCount(0)
  await anna.getByRole('button', { name: 'Togli Vacanze di Pasqua: 25/03/2027 – 30/03/2027' }).click()
  await expect(anna.getByText('Vacanze regionali mancanti')).toBeVisible()
  await anna.getByRole('button', { name: 'Aggiungi le vacanze regionali' }).click()
  await expect(anna.getByText('Vacanze regionali mancanti')).toHaveCount(0)
  await expect(anna.getByText('Vacanze di Pasqua: 25/03/2027 – 30/03/2027')).toBeVisible()

  // Anna elimina l'interrogazione
  await anna.getByRole('tab', { name: 'Materie' }).click()
  await anna.getByRole('link', { name: 'Matematica' }).click()
  await anna.getByRole('link', { name: /Orale capitolo 3/ }).click()
  await anna.getByRole('button', { name: 'Elimina', exact: true }).click()
  await conferma(anna, 'Elimina')
  await expect(anna.getByText('Nessuna interrogazione.')).toBeVisible()
  await expect(carla.getByRole('heading', { name: 'Interrogazione non trovata' })).toBeVisible()
})
