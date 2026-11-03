import { expect, test } from '@playwright/test'
import { accedi, leggiCodice, svuotaEmulatori } from './aiuti'

test.beforeEach(async () => {
  await svuotaEmulatori()
})

test('guida della classe nuova e orario a griglia', async ({ browser }, info) => {
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('3ªA')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const passi = anna.getByRole('list', { name: 'Passi per preparare la classe' })
  await expect(anna.getByRole('heading', { name: 'Prepara la classe (0 di 4)' })).toBeVisible()
  await anna.screenshot({ path: info.outputPath('guida.png'), fullPage: true })

  // 1. Materie (senza giorni), poi l'orario nella griglia
  await passi.getByRole('link', { name: 'Aggiungi le materie' }).click()
  for (const nome of ['Storia', 'Matematica']) {
    await anna.getByLabel('Nome', { exact: true }).fill(nome)
    await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
    await expect(anna.getByRole('link', { name: nome })).toBeVisible()
  }
  await anna.getByRole('tab', { name: 'Orario' }).click()
  await anna.getByRole('checkbox', { name: 'Storia martedì' }).check()
  await anna.getByRole('checkbox', { name: 'Matematica lunedì' }).check()
  await anna.getByRole('checkbox', { name: 'Matematica giovedì' }).check()
  await anna.getByRole('button', { name: 'Salva orario' }).click()
  await anna.getByRole('tab', { name: 'Materie' }).click()
  await expect(anna.getByText('lun · gio')).toBeVisible()
  await expect(anna.getByRole('listitem').filter({ hasText: 'Storia' }).getByText('mar', { exact: true })).toBeVisible()
  // "Annulla" riporta l'orario com'era, poi lo risalviamo
  await anna.getByRole('button', { name: 'Annulla: Orario salvato' }).click()
  await expect(anna.getByText('lun · gio')).toHaveCount(0)
  await anna.getByRole('tab', { name: 'Orario' }).click()
  await anna.getByRole('checkbox', { name: 'Storia martedì' }).check()
  await anna.getByRole('button', { name: 'Salva orario' }).click()
  await anna.getByRole('tab', { name: 'Materie' }).click()
  await expect(anna.getByRole('listitem').filter({ hasText: 'Storia' }).getByText('mar', { exact: true })).toBeVisible()
  await anna.screenshot({ path: info.outputPath('orario.png'), fullPage: true })

  // 2. Calendario: "Va bene così"
  await anna.getByRole('link', { name: /3ªA/ }).click()
  await expect(anna.getByRole('heading', { name: 'Prepara la classe (1 di 4)' })).toBeVisible()
  await passi.getByRole('button', { name: 'Va bene così' }).click()
  await expect(anna.getByRole('heading', { name: 'Prepara la classe (2 di 4)' })).toBeVisible()

  // 3. Entra un compagno (in tempo reale)
  await expect(passi.getByRole('link', { name: 'WhatsApp' })).toBeVisible()
  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()
  await expect(anna.getByRole('heading', { name: 'Prepara la classe (3 di 4)' })).toBeVisible()
  await expect(bruno.getByRole('heading', { name: /Prepara la classe/ })).toHaveCount(0) // solo il capo

  // 4. Prima interrogazione: la guida sparisce
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Orale')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale' })).toBeVisible()
  await anna.getByRole('link', { name: 'Matematica', exact: true }).click() // torna alla materia
  await anna.getByRole('link', { name: /3ªA/ }).click()
  await expect(anna.getByRole('heading', { name: 'Interrogazioni' })).toBeVisible()
  await expect(anna.getByRole('heading', { name: /Prepara la classe/ })).toHaveCount(0)
})
