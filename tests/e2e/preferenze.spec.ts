import { expect, test, type Page } from '@playwright/test'
import { accedi, leggiCodice, svuotaEmulatori } from './aiuti'

test.beforeEach(async () => {
  await svuotaEmulatori()
})

function dataOraLocale(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}

async function apriInterrogazione(page: Page, nome: string) {
  await page.getByRole('link', { name: new RegExp(nome) }).click()
  await expect(page.getByRole('heading', { name: nome })).toBeVisible()
}

test('preferenze, generazione e lista', async ({ browser }, info) => {
  // Classe: Anna capo, Bruno e Carla studenti (Carla DSA), prof. Rossi
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('4ªB')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()
  const carla = await accedi(browser, 'carla.blu@studenti.ittsrimini.edu.it', 'Carla Blu', `/unisciti/${codice}`)
  await carla.getByRole('button', { name: 'Entra', exact: true }).click()
  const rossi = await accedi(browser, 'mario.rossi@ittsrimini.edu.it', 'Prof Rossi', `/unisciti/${codice}`)
  await rossi.getByRole('button', { name: 'Entra', exact: true }).click()

  await anna.getByRole('link', { name: 'Gestisci classe' }).click()
  await anna.getByRole('listitem').filter({ hasText: 'Carla Blu' }).getByRole('button', { name: 'Dai DSA/BES' }).click()
  await expect(anna.getByRole('listitem').filter({ hasText: 'Carla Blu' }).getByText('DSA/BES', { exact: true })).toBeVisible()

  // Materia e interrogazione (1 studente per lezione, martedì e giovedì)
  await anna.getByRole('link', { name: /4ªB/ }).click()
  await anna.getByRole('link', { name: 'Materie e calendario' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Storia')
  const giorni = anna.getByRole('group', { name: 'Giorni di lezione' })
  await giorni.getByRole('button', { name: 'martedì' }).click()
  await giorni.getByRole('button', { name: 'giovedì' }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await anna.getByRole('link', { name: 'Storia' }).click()
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Orale Risorgimento')
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('1')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale Risorgimento' })).toBeVisible()

  // Preferenze: Anna inizio, Bruno fine, Carla posizione n° 1
  await anna.getByRole('radio', { name: /Inizio/ }).click()
  await expect(anna.getByText('La tua scelta: inizio')).toBeVisible()

  await apriInterrogazione(bruno, 'Orale Risorgimento')
  await expect(bruno.getByText('Con il badge DSA/BES')).toHaveCount(0)
  await bruno.getByRole('radio', { name: /Fine/ }).click()
  await expect(bruno.getByText('La tua scelta: fine')).toBeVisible()
  await expect(bruno.getByText(/Preferenze ricevute/)).toHaveCount(0) // solo capo e vice

  await apriInterrogazione(carla, 'Orale Risorgimento')
  await carla.getByLabel('Posizione').selectOption('1')
  await carla.getByRole('button', { name: 'Chiedi questa posizione' }).click()
  await expect(carla.getByText('La tua scelta: posizione n° 1')).toBeVisible()

  await apriInterrogazione(rossi, 'Orale Risorgimento')
  await expect(rossi.getByText('Gli studenti stanno scegliendo le preferenze')).toBeVisible()
  await expect(rossi.getByRole('radio')).toHaveCount(0)

  // Anna vede chi ha scelto cosa
  await expect(anna.getByText('Preferenze ricevute (3/3)')).toBeVisible()
  await expect(anna.getByText('Carla Blu (n° 1)')).toBeVisible()
  await expect(anna.getByRole('button', { name: 'Genera lista' })).toHaveCount(0)

  // Anna anticipa la scadenza: le preferenze si chiudono per tutti
  await anna.getByRole('button', { name: 'Modifica' }).click()
  await anna.getByLabel('Scadenza per le preferenze').fill(dataOraLocale(new Date(Date.now() - 60_000)))
  await anna.getByRole('button', { name: 'Salva modifiche' }).click()
  await expect(bruno.getByText(/Le preferenze sono chiuse/)).toBeVisible()
  await expect(bruno.getByRole('radio')).toHaveCount(0)

  // Anna genera la lista
  anna.once('dialog', (d) => d.accept())
  await anna.getByRole('button', { name: 'Genera lista' }).click()
  const ordine = anna.getByRole('list', { name: 'Ordine delle interrogazioni' })
  await expect(ordine.getByRole('listitem')).toHaveCount(3)
  await expect(ordine.getByRole('listitem').nth(0)).toContainText('Carla Blu')
  await expect(ordine.getByRole('listitem').nth(1)).toContainText('Anna Verdi')
  await expect(ordine.getByRole('listitem').nth(2)).toContainText('Bruno Neri')
  await expect(anna.getByText('Sei il n° 2 di 3')).toBeVisible()
  await expect(anna.getByText('Rapporto (visibile a capoclasse e vice)')).toBeVisible()
  await expect(anna.getByText('DSA/BES alla posizione esatta: 1 su 1')).toBeVisible()
  await expect(anna.getByText('Inizio ottenuto: 1 su 1')).toBeVisible()
  await expect(anna.getByText('Fine ottenuta: 1 su 1')).toBeVisible()

  // Tutti vedono la lista (in tempo reale); la stima della data c'è
  await expect(bruno.getByText('Sei il n° 3 di 3')).toBeVisible()
  await expect(bruno.getByText(/^Stimata: (Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato) \d{2}\/\d{2}$/).first()).toBeVisible()
  await expect(carla.getByText('Sei il n° 1 di 3')).toBeVisible()
  await expect(carla.getByText('Rapporto (visibile a capoclasse e vice)')).toHaveCount(0)
  await expect(rossi.getByRole('list', { name: 'Ordine delle interrogazioni' }).getByRole('listitem')).toHaveCount(3)
  await expect(rossi.getByText(/^Sei il n°/)).toHaveCount(0)
  await expect(rossi.getByText('Rapporto (visibile a capoclasse e vice)')).toHaveCount(0)

  await bruno.screenshot({ path: info.outputPath('lista-studente.png'), fullPage: true })
  await anna.screenshot({ path: info.outputPath('lista-capo.png'), fullPage: true })
})
