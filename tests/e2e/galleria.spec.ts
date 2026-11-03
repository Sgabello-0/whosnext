import { expect, test, type Page } from '@playwright/test'
import { accedi, conferma, leggiCodice, svuotaEmulatori } from './aiuti'

// Non è un test: crea una classe di esempio e fotografa le pagine principali,
// per controllare l'aspetto del sito. Si avvia solo a richiesta:
//   GALLERIA=cartella npm run test:e2e -- galleria --project telefono
const CARTELLA = process.env.GALLERIA
test.skip(!CARTELLA, 'galleria di screenshot: solo a richiesta (GALLERIA=cartella)')
test.setTimeout(240_000)

function dataOraLocale(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}

test('galleria', async ({ browser }, info) => {
  await svuotaEmulatori()
  const foto = async (page: Page, nome: string) => {
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${CARTELLA}/${info.project.name}-${nome}.png`, fullPage: true })
  }

  const login = await (await browser.newContext()).newPage()
  await login.goto('/')
  await foto(login, '01-login')

  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await foto(anna, '02-home-vuota')
  await anna.getByLabel('Nome della classe').fill('4ªB Informatica')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const classe = new URL(anna.url()).pathname
  await foto(anna, '03-classe-nuova')

  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await foto(bruno, '04-unisciti')
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()
  const carla = await accedi(browser, 'carla.blu@studenti.ittsrimini.edu.it', 'Carla Blu', `/unisciti/${codice}`)
  await carla.getByRole('button', { name: 'Entra', exact: true }).click()

  // Materie
  await anna.goto(`${classe}/configura`)
  for (const [nome, giorni] of [
    ['Storia', ['martedì', 'giovedì']],
    ['Matematica', ['lunedì', 'mercoledì', 'venerdì']],
  ] as const) {
    await anna.getByLabel('Nome', { exact: true }).fill(nome)
    const g = anna.getByRole('group', { name: 'Giorni di lezione' })
    for (const d of giorni) await g.getByRole('button', { name: d }).click()
    await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
    await expect(anna.getByRole('link', { name: nome })).toBeVisible()
  }
  await foto(anna, '05-configura')
  await anna.getByRole('tab', { name: 'Orario' }).click()
  await foto(anna, '05b-configura-orario')
  await anna.getByRole('tab', { name: 'Calendario' }).click()
  await foto(anna, '05c-configura-calendario')

  // Due interrogazioni: una resta aperta, l'altra diventa lista
  for (const [materia, nome] of [
    ['Matematica', 'Verifica orale'],
    ['Storia', 'Orale Risorgimento'],
  ] as const) {
    await anna.goto(classe)
    await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
    await anna.getByLabel('Materia').selectOption({ label: materia })
    await anna.getByLabel('Nome', { exact: true }).fill(nome)
    await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('1')
    await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
    await expect(anna.getByRole('heading', { name: nome })).toBeVisible()
  }
  await anna.getByRole('radio', { name: /Inizio/ }).click()
  await foto(anna, '06-interrogazione-raccolta-capo')

  await bruno.goto('/')
  await bruno.getByRole('link', { name: /Orale Risorgimento/ }).first().click()
  await foto(bruno, '07-interrogazione-raccolta-studente')
  await bruno.getByRole('radio', { name: /Fine/ }).click()

  // Chiude le preferenze e genera la lista
  await anna.getByRole('button', { name: 'Modifica' }).click()
  await anna.getByLabel('Scadenza per le preferenze').fill(dataOraLocale(new Date(Date.now() - 60_000)))
  await anna.getByRole('button', { name: 'Salva modifiche' }).click()
  await anna.getByRole('button', { name: 'Genera lista' }).click()
  await conferma(anna, 'Genera lista')
  await expect(anna.getByRole('list', { name: 'Ordine delle interrogazioni' }).getByRole('listitem')).toHaveCount(3)
  await foto(anna, '08-lista-capo')
  await bruno.reload()
  await expect(bruno.getByText(/Sei il n°/)).toBeVisible()
  await foto(bruno, '09-lista-studente')

  await anna.goto('/')
  await foto(anna, '10-home-capo')
  await bruno.goto('/')
  await foto(bruno, '11-home-studente')
  await bruno.goto(classe)
  await foto(bruno, '12-classe-studente')
  await anna.goto(classe)
  await foto(anna, '13-classe-capo')
  await anna.getByRole('link', { name: 'Gestisci classe' }).click()
  await foto(anna, '14-gestione')
  await anna.goto(classe)
  await anna.getByRole('link', { name: 'Storia' }).first().click()
  await foto(anna, '15-materia')
})
