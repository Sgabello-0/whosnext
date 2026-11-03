import { expect, test } from '@playwright/test'
import { accedi, conferma, leggiCodice, svuotaEmulatori } from './aiuti'

test.beforeEach(async () => {
  await svuotaEmulatori()
})

test('il capoclasse passa il ruolo a un compagno', async ({ browser }) => {
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('5ªC')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()
  await expect(bruno.getByText('tu sei studente')).toBeVisible()
  const rossi = await accedi(browser, 'mario.rossi@ittsrimini.edu.it', 'Prof Rossi', `/unisciti/${codice}`)
  await rossi.getByRole('button', { name: 'Entra', exact: true }).click()

  await anna.getByRole('link', { name: 'Gestisci classe' }).click()
  const nuovo = anna.getByLabel('Nuovo capoclasse')
  // i docenti non sono tra i candidati
  await expect(nuovo.getByRole('option', { name: /Prof Rossi/ })).toHaveCount(0)
  await nuovo.selectOption({ label: 'Bruno Neri' })
  await expect(anna.getByLabel('Resto vice')).toBeChecked()
  await anna.getByRole('button', { name: 'Passa il ruolo' }).click()
  await conferma(anna, 'Passa il ruolo')

  // Anna ora è vice (gestisce solo i DSA), Bruno è capoclasse
  await expect(anna.getByText('Come vice puoi dare e togliere il badge DSA/BES.')).toBeVisible()
  await expect(anna.getByRole('button', { name: 'Elimina classe…' })).toHaveCount(0)
  await expect(bruno.getByText('tu sei capoclasse')).toBeVisible()
  await bruno.getByRole('link', { name: 'Gestisci classe' }).click()
  await expect(bruno.getByRole('button', { name: 'Elimina classe…' })).toBeVisible()
  await expect(bruno.getByRole('listitem').filter({ hasText: 'Anna Verdi' }).getByText('Vice', { exact: true })).toBeVisible()
})
