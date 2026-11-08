import { expect, test } from '@playwright/test'
import { accedi, conferma, leggiCodice, svuotaEmulatori } from './aiuti'

test.beforeEach(async () => {
  await svuotaEmulatori()
})

function dataOraLocale(d: Date): string {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`
}

test('"Le mie interrogazioni" e "Da fare" nella pagina iniziale', async ({ browser }, info) => {
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('4ªB')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()

  // Anna: materia e interrogazione
  await anna.getByRole('link', { name: 'Materie e calendario' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Storia')
  await anna.getByRole('group', { name: 'Giorni di lezione' }).getByRole('button', { name: 'martedì' }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await expect(anna.getByRole('link', { name: 'Storia' })).toBeVisible()
  await anna.getByRole('main').getByRole('link', { name: /4ªB/ }).click()
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Orale')
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('1')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale' })).toBeVisible()

  // Bruno, nella pagina iniziale: da scegliere
  await bruno.getByRole('link', { name: 'WhosNext' }).click()
  const mieBruno = bruno.getByRole('list', { name: 'Le mie interrogazioni' })
  await expect(mieBruno.getByText('Storia – Orale')).toBeVisible()
  await expect(mieBruno.getByText(/Scegli quando essere interrogato entro/)).toBeVisible()
  await expect(bruno.getByRole('list', { name: 'Da fare' })).toHaveCount(0) // non è capo

  // Anna, nella pagina iniziale: "0 su 2 hanno scelto"
  await anna.getByRole('link', { name: 'WhosNext' }).click()
  const daFare = anna.getByRole('list', { name: 'Da fare' })
  await expect(daFare.getByText(/0 su 2 hanno scelto/)).toBeVisible()

  // Bruno sceglie partendo dalla voce
  await mieBruno.getByRole('link', { name: /Storia – Orale/ }).click()
  await bruno.getByRole('radio', { name: /Fine/ }).click()
  await expect(bruno.getByText('La tua scelta: fine')).toBeVisible()
  await bruno.getByRole('link', { name: 'WhosNext' }).click()
  await expect(mieBruno.getByText(/Hai scelto: fine/)).toBeVisible()
  await expect(daFare.getByText(/1 su 2 hanno scelto/)).toBeVisible() // Anna, in tempo reale

  // Anna anticipa la scadenza: per lei "genera la lista", per Bruno "lista in arrivo"
  await daFare.getByRole('link', { name: /Storia – Orale/ }).click()
  await anna.getByRole('button', { name: 'Modifica' }).click()
  await anna.getByLabel('Scadenza per le preferenze').fill(dataOraLocale(new Date(Date.now() - 60_000)))
  await anna.getByRole('button', { name: 'Salva modifiche' }).click()
  await expect(mieBruno.getByText(/Preferenze chiuse: la lista sarà pubblicata a breve/)).toBeVisible()
  await anna.getByRole('link', { name: 'WhosNext' }).click()
  await expect(daFare.getByText('Le preferenze sono chiuse: genera la lista')).toBeVisible()
  await anna.screenshot({ path: info.outputPath('home-capo.png'), fullPage: true })

  // Dalla voce "da fare" si arriva al pulsante "Genera lista"
  await daFare.getByRole('link', { name: /genera la lista/ }).click()
  await anna.getByRole('button', { name: 'Genera lista' }).click()
  await conferma(anna, 'Genera lista')
  await expect(anna.getByText(/Sei il n° \d di 2/)).toBeVisible()

  // Bruno vede la sua posizione nella pagina iniziale
  await expect(mieBruno.getByText(/n° \d di 2/)).toBeVisible()
  await bruno.screenshot({ path: info.outputPath('home-studente.png'), fullPage: true })
})
