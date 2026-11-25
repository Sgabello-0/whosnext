import { expect, test } from '@playwright/test'
import { accedi, conferma, leggiCodice, svuotaEmulatori } from './aiuti'

test.beforeEach(async () => {
  await svuotaEmulatori()
})

function dataOraLocale(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}

test('docente: materie assegnate, "Fine" della lezione e giorni senza interrogazioni', async ({ browser }, info) => {
  // Anna crea la classe con due materie; entrano Bruno, Carla e il prof. Rossi
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('4ªB')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const classe = new URL(anna.url()).pathname
  for (const [email, nome] of [
    ['bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri'],
    ['carla.blu@studenti.ittsrimini.edu.it', 'Carla Blu'],
  ]) {
    const p = await accedi(browser, email!, nome!, `/unisciti/${codice}`)
    await p.getByRole('button', { name: 'Entra', exact: true }).click()
    await expect(p.getByRole('heading', { name: '4ªB' })).toBeVisible()
  }
  const rossi = await accedi(browser, 'mario.rossi@ittsrimini.edu.it', 'Prof Rossi', `/unisciti/${codice}`)
  await rossi.getByRole('button', { name: 'Entra', exact: true }).click()
  await expect(rossi.getByText('Nessuna materia assegnata')).toBeVisible()

  await anna.goto(`${classe}/configura`)
  for (const nome of ['Storia', 'Matematica']) {
    await anna.getByLabel('Nome', { exact: true }).fill(nome)
    const giorni = anna.getByRole('group', { name: 'Giorni di lezione' })
    for (const g of ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì']) await giorni.getByRole('button', { name: g }).click()
    await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
    await expect(anna.getByRole('main').getByRole('link', { name: nome })).toBeVisible()
  }

  // Anna assegna Storia al prof. Rossi
  await anna.goto(`${classe}/gestione`)
  const materieRossi = anna.getByRole('group', { name: 'Materie di Prof Rossi' })
  await materieRossi.getByRole('button', { name: 'Storia' }).click()
  await expect(materieRossi.getByRole('button', { name: 'Storia' })).toHaveAttribute('aria-pressed', 'true')
  await expect(materieRossi.getByRole('button', { name: 'Matematica' })).toHaveAttribute('aria-pressed', 'false')
  await anna.screenshot({ path: info.outputPath('gestione-materie.png'), fullPage: true })

  // Rossi (in tempo reale) vede la sua materia in evidenza, anche senza interrogazioni
  await expect(rossi.getByText('Le tue materie: Storia')).toBeVisible()
  await expect(rossi.getByText('La tua materia')).toBeVisible()

  // Anna crea l'interrogazione di Storia e genera la lista
  await anna.goto(classe)
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await anna.getByLabel('Materia').selectOption({ label: 'Storia' })
  await anna.getByLabel('Nome', { exact: true }).fill('Orale')
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('1')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale' })).toBeVisible()
  const interrogazione = anna.url()
  await anna.getByRole('button', { name: 'Modifica' }).click()
  await anna.getByLabel('Scadenza per le preferenze').fill(dataOraLocale(new Date(Date.now() - 60_000)))
  await anna.getByRole('button', { name: 'Salva modifiche' }).click()
  await anna.getByRole('button', { name: 'Genera lista' }).click()
  await conferma(anna, 'Genera lista')
  const ordine = anna.getByRole('list', { name: 'Ordine delle interrogazioni' })
  await expect(ordine.getByRole('listitem')).toHaveCount(3)
  const primo = (await ordine.getByRole('listitem').first().locator('span.truncate').textContent())!.trim()

  // Rossi segna e chiude la lezione con "Fine"; non riordina e non ha "Ha saltato"
  await rossi.goto(interrogazione)
  const segna = rossi.locator('section', { hasText: 'Segna chi è stato interrogato' })
  await expect(segna.getByRole('checkbox', { name: primo })).toBeChecked()
  await expect(segna.getByRole('button', { name: /^Ha saltato/ })).toHaveCount(0)
  await expect(rossi.getByRole('button', { name: 'Modifica la lista' })).toHaveCount(0)
  await rossi.screenshot({ path: info.outputPath('segna-docente.png'), fullPage: true })
  await segna.getByRole('button', { name: 'Fine' }).click()
  await expect(rossi.getByText(new RegExp(`Lezione di .* chiusa: ${primo} interrogato`))).toBeVisible()
  await expect(segna.getByText('Lezione chiusa')).toBeVisible()
  await expect(segna.getByText(`Interrogati: ${primo}.`)).toBeVisible()
  await rossi.screenshot({ path: info.outputPath('lezione-chiusa.png'), fullPage: true })
  await expect(ordine.getByRole('listitem').filter({ hasText: primo })).toContainText('interrogato')

  // Modifica: era assente, si toglie il segno; la lezione resta chiusa
  await segna.getByRole('button', { name: 'Modifica' }).click()
  await segna.getByRole('checkbox', { name: primo }).uncheck()
  await segna.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(segna.getByText('Nessuno è stato interrogato in questa lezione.')).toBeVisible()
  await expect(ordine.getByRole('listitem').filter({ hasText: primo })).not.toContainText('interrogato')
  await rossi.getByText(/Storico delle modifiche/).click()
  const storico = rossi.getByRole('list', { name: 'Storico delle modifiche' })
  await expect(storico.getByText(new RegExp(`Prof Rossi ha chiuso la lezione di .* \\(interrogati: ${primo}\\)`))).toBeVisible()
  await expect(storico.getByText(new RegExp(`Prof Rossi ha modificato gli interrogati di .* \\(tolto il segno a ${primo}\\)`))).toBeVisible()
  // la lezione chiusa non è più "da fare" per il capoclasse
  await anna.goto(classe)
  await expect(anna.getByText(/Segna chi è stato interrogato/)).toHaveCount(0)

  // Anna segna in Storia un giorno di spiegazione (il primo segnato crea anche il calendario della classe)
  await anna.getByRole('main').getByRole('link', { name: 'Storia' }).click()
  const senzaAnna = anna.locator('section', { hasText: 'Giorni senza interrogazioni' })
  const spiegazione = (await senzaAnna.getByLabel('Lezione').locator('option').first().textContent())!.trim()
  await senzaAnna.getByRole('button', { name: 'Niente interrogazioni quel giorno' }).click()
  await expect(senzaAnna.getByRole('list', { name: 'Giorni senza interrogazioni' })).toContainText(`${spiegazione} · Spiegazione`)

  // Rossi segna un giorno senza interrogazioni nella sua materia; Anna lo vede
  await rossi.goto(classe)
  await rossi.getByRole('main').getByRole('link', { name: 'Storia' }).click()
  await expect(rossi.getByText('La tua materia')).toBeVisible()
  const senza = rossi.locator('section', { hasText: 'Giorni senza interrogazioni' })
  await expect(senza.getByRole('list', { name: 'Giorni senza interrogazioni' })).toContainText(spiegazione)
  const giorno = (await senza.getByLabel('Lezione').locator('option').first().textContent())!.trim()
  expect(giorno).not.toBe(spiegazione)
  await senza.getByLabel('Motivo').selectOption('verifica')
  await senza.getByRole('button', { name: 'Niente interrogazioni quel giorno' }).click()
  await expect(senza.getByRole('list', { name: 'Giorni senza interrogazioni' })).toContainText(`${giorno} · Verifica`)
  await expect(senza.getByRole('list', { name: 'Giorni senza interrogazioni' })).toContainText('Segnato da Prof Rossi')
  await expect(senzaAnna).toContainText(`${giorno} · Verifica`)

  await rossi.screenshot({ path: info.outputPath('materia.png'), fullPage: true })

  // nella classe Storia è in evidenza; Matematica (non sua, senza interrogazioni) non compare
  await rossi.goto(classe)
  await expect(rossi.getByText('Le tue materie: Storia')).toBeVisible()
  await expect(rossi.getByRole('main').getByRole('link', { name: 'Storia' })).toBeVisible()
  await expect(rossi.getByRole('main').getByRole('link', { name: 'Matematica' })).toHaveCount(0)
  await rossi.screenshot({ path: info.outputPath('classe-docente.png'), fullPage: true })

  // sul computer, nella barra laterale prima le materie con interrogazioni in corso (con il simbolo della lista pronta)
  if (info.project.name === 'desktop') {
    const barra = rossi.getByRole('navigation', { name: 'Menu principale' }).getByRole('group', { name: '4ªB' })
    await expect(barra.getByRole('link')).toHaveText([/^Storia, lista pronta$/, /^Matematica$/])
  }
})
