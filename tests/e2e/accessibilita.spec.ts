import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { accedi, conferma, leggiCodice, svuotaEmulatori } from './aiuti'

// Accessibilità (WCAG 2.1 A e AA) delle pagine principali, con il tema chiaro e quello scuro:
// etichette dei campi, nomi dei pulsanti, contrasto dei colori, ruoli, titoli.
test.setTimeout(240_000)

async function controlla(page: Page, dove: string) {
  for (const tema of ['chiaro', 'scuro'] as const) {
    await page.evaluate((t) => {
      document.documentElement.dataset.tema = t
    }, tema)
    // fine delle animazioni d'ingresso (cambiano l'opacità e falserebbero il contrasto)
    await page.waitForTimeout(700)
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    const problemi = r.violations.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n` +
        v.nodes
          .slice(0, 6)
          .map((n) => `      ${n.html.slice(0, 110)}\n        → ${(n.any[0]?.message ?? '').slice(0, 160)}`)
          .join('\n'),
    )
    expect.soft(problemi, `${dove}, tema ${tema}`).toEqual([])
  }
}

test('pagine principali accessibili, tema chiaro e scuro', async ({ browser }) => {
  await svuotaEmulatori()
  const ospite = await (await browser.newContext()).newPage()
  await ospite.goto('/')
  await expect(ospite.getByRole('button', { name: 'Accedi con Google' })).toBeVisible()
  await controlla(ospite, 'accesso')

  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await controlla(anna, 'home vuota')
  await anna.getByLabel('Nome della classe').fill('4ªB')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const classe = new URL(anna.url()).pathname
  await controlla(anna, 'classe nuova (con la guida)')

  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await expect(bruno.getByRole('button', { name: 'Entra', exact: true })).toBeVisible()
  await controlla(bruno, 'unisciti')
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()

  await anna.goto(`${classe}/configura`)
  await anna.getByLabel('Nome', { exact: true }).fill('Storia')
  await anna.getByRole('group', { name: 'Giorni di lezione' }).getByRole('button', { name: 'martedì' }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await expect(anna.getByRole('link', { name: 'Storia' })).toBeVisible()
  await controlla(anna, 'configura: materie')
  await anna.getByRole('tab', { name: 'Orario' }).click()
  await controlla(anna, 'configura: orario')
  await anna.getByRole('tab', { name: 'Calendario' }).click()
  await controlla(anna, 'configura: calendario')

  await anna.goto(classe)
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await controlla(anna, 'nuova interrogazione (modulo)')
  await anna.getByLabel('Materia').selectOption({ label: 'Storia' })
  await anna.getByLabel('Nome', { exact: true }).fill('Orale')
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('1')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale' })).toBeVisible()
  const interr = anna.url()
  await controlla(anna, 'interrogazione in raccolta (capo)')
  await bruno.goto(interr)
  await expect(bruno.getByRole('radio', { name: /Inizio/ })).toBeVisible()
  await controlla(bruno, 'interrogazione in raccolta (studente)')

  await anna.getByText('Prossime lezioni').click()
  await anna.getByRole('button', { name: 'Modifica' }).click()
  const passato = new Date(Date.now() - 60_000)
  const z = (n: number) => String(n).padStart(2, '0')
  await anna
    .getByLabel('Scadenza per le preferenze')
    .fill(`${passato.getFullYear()}-${z(passato.getMonth() + 1)}-${z(passato.getDate())}T${z(passato.getHours())}:${z(passato.getMinutes())}`)
  await anna.getByRole('button', { name: 'Salva modifiche' }).click()
  await anna.getByRole('button', { name: 'Genera lista' }).click()
  await conferma(anna, 'Genera lista')
  await expect(anna.getByRole('list', { name: 'Ordine delle interrogazioni' })).toBeVisible()
  await controlla(anna, 'lista (capo)')
  await bruno.reload()
  await expect(bruno.getByText(/Sei il n°/)).toBeVisible()
  await controlla(bruno, 'lista (studente)')

  for (const [p, dove] of [
    [anna, '/'],
    [anna, `${classe}/gestione`],
    [anna, '/impostazioni'],
    [bruno, '/'],
    [bruno, classe],
  ] as const) {
    await p.goto(dove)
    await expect(p.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await controlla(p, dove)
  }
})
