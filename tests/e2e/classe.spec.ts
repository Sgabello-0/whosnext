import { expect, test } from '@playwright/test'
import { accedi, conferma, leggiCodice, svuotaEmulatori } from './aiuti'

test.beforeEach(async () => {
  await svuotaEmulatori()
})

test('account esterni alla scuola non entrano', async ({ browser }) => {
  const page = await accedi(browser, 'mario.rossi@gmail.com', 'Mario Gmail')
  await expect(page.getByRole('heading', { name: 'Account non ammesso' })).toBeVisible()
  await expect(page.getByText('Possono entrare solo gli account della scuola')).toBeVisible()
  await page.getByRole('button', { name: 'Esci e cambia account' }).click()
  await expect(page.getByRole('button', { name: 'Accedi con Google' })).toBeVisible()
})

test('i docenti non vedono "Crea una classe"', async ({ browser }) => {
  const page = await accedi(browser, 'mario.rossi@ittsrimini.edu.it', 'Prof Rossi')
  await expect(page.getByText('Account docente')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Unisciti a una classe' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Crea una classe' })).toHaveCount(0)
})

test('percorso completo: classe, inviti, docente, vice, DSA, uscita', async ({ browser }, info) => {
  // 1. Anna crea la classe e ne diventa capoclasse
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await expect(anna.getByRole('heading', { name: 'Ciao Anna' })).toBeVisible()
  await anna.getByLabel('Nome della classe').fill('4ªB Informatica')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  await expect(anna.getByRole('heading', { name: '4ªB Informatica' })).toBeVisible()
  await expect(anna.getByText('tu sei capoclasse')).toBeVisible()
  const codice = await leggiCodice(anna)

  // 2. Bruno entra con il link d'invito (login dopo aver aperto il link)
  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await expect(bruno.getByText('Stai per entrare in 4ªB Informatica come studente')).toBeVisible()
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()
  await expect(bruno.getByRole('heading', { name: '4ªB Informatica' })).toBeVisible()
  await expect(bruno.getByText('Anna Verdi')).toBeVisible()

  // 3. Carla entra scrivendo il codice a mano (minuscolo, con il trattino)
  const carla = await accedi(browser, 'carla.blu@studenti.ittsrimini.edu.it', 'Carla Blu')
  await carla.getByLabel("Codice o link d'invito").fill(`${codice.slice(0, 3)}-${codice.slice(3)}`.toLowerCase())
  await carla.getByRole('button', { name: 'Continua' }).click()
  await carla.getByRole('button', { name: 'Entra', exact: true }).click()
  await expect(carla.getByRole('heading', { name: 'Studenti (3)' })).toBeVisible()

  // 4. Il prof. Rossi entra come docente e chiede il permesso
  const rossi = await accedi(browser, 'mario.rossi@ittsrimini.edu.it', 'Prof Rossi', `/unisciti/${codice}`)
  await expect(rossi.getByText('Stai per entrare in 4ªB Informatica come docente')).toBeVisible()
  await rossi.getByRole('button', { name: 'Entra', exact: true }).click()
  await expect(rossi.getByText('Accesso in sola lettura')).toBeVisible()
  await expect(rossi.getByRole('link', { name: 'Gestisci classe' })).toHaveCount(0)
  await rossi.getByRole('button', { name: 'Chiedi il permesso di modifica' }).click()
  await expect(rossi.getByText('Richiesta inviata, in attesa del capoclasse.')).toBeVisible()

  // 5. Anna (in tempo reale) vede il docente, accetta la richiesta, nomina Bruno vice e dà il DSA a Carla
  await expect(anna.getByRole('heading', { name: 'Docenti (1)' })).toBeVisible()
  await anna.getByRole('link', { name: 'Gestisci classe' }).click()
  await expect(anna.getByText('Prof Rossi chiede di poter modificare le liste')).toBeVisible()
  await anna.getByRole('button', { name: 'Accetta' }).click()
  await expect(rossi.getByText('Puoi modificare le liste')).toBeVisible()

  const rigaBruno = anna.getByRole('listitem').filter({ hasText: 'Bruno Neri' })
  await rigaBruno.getByRole('button', { name: 'Nomina vice' }).click()
  await expect(rigaBruno.getByText('Vice', { exact: true })).toBeVisible()

  const rigaCarla = anna.getByRole('listitem').filter({ hasText: 'Carla Blu' })
  await rigaCarla.getByRole('button', { name: 'Dai DSA/BES' }).click()
  await expect(rigaCarla.getByText('DSA/BES', { exact: true })).toBeVisible()
  await anna.screenshot({ path: info.outputPath('avviso.png') })
  // "Annulla" nel messaggio in basso toglie di nuovo il badge; poi lo ridiamo
  await anna.getByRole('button', { name: 'Annulla: Badge DSA/BES dato a Carla Blu' }).click()
  await expect(rigaCarla.getByText('DSA/BES', { exact: true })).toHaveCount(0)
  await rigaCarla.getByRole('button', { name: 'Dai DSA/BES' }).click()
  await expect(rigaCarla.getByText('DSA/BES', { exact: true })).toBeVisible()

  // 6. Carla vede il proprio badge, il docente no; Bruno (vice) vede il badge di Carla e la gestione
  await expect(carla.getByText('Hai il badge')).toBeVisible()
  await expect(rossi.getByText('DSA/BES', { exact: true })).toHaveCount(0)
  await expect(bruno.getByRole('link', { name: 'Gestisci classe' })).toBeVisible()
  await expect(bruno.getByRole('listitem').filter({ hasText: 'Carla Blu' }).getByText('DSA/BES', { exact: true })).toBeVisible()

  await anna.screenshot({ path: info.outputPath('gestione-capo.png'), fullPage: true })
  await carla.screenshot({ path: info.outputPath('classe-studente.png'), fullPage: true })

  // 7. Carla esce dalla classe
  await carla.getByRole('button', { name: 'Esci dalla classe' }).click()
  await conferma(carla, 'Esci dalla classe')
  await expect(carla.getByText('Non sei ancora in nessuna classe')).toBeVisible()
  await expect(anna.getByRole('heading', { name: 'Studenti (2)' })).toBeVisible()

  // 8. Anna cambia il codice: quello vecchio non funziona più
  await anna.getByRole('button', { name: "Cambia codice d'invito" }).click()
  await conferma(anna, 'Cambia codice')
  await expect(anna.getByText('Nuovo codice:')).toBeVisible()
  await carla.goto(`/unisciti/${codice}`)
  await expect(carla.getByRole('heading', { name: 'Codice non valido' })).toBeVisible()

  // 9. Anna rimuove Bruno: Bruno lo vede subito
  await anna.getByRole('link', { name: /4ªB Informatica/ }).click()
  await anna.getByRole('link', { name: 'Gestisci classe' }).click()
  await anna.getByRole('listitem').filter({ hasText: 'Bruno Neri' }).getByRole('button', { name: 'Rimuovi' }).click()
  await conferma(anna, 'Rimuovi')
  await expect(bruno.getByRole('heading', { name: 'Non fai parte di questa classe' })).toBeVisible()
})

test('il capoclasse elimina la classe', async ({ browser }, info) => {
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('Classe di prova')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()
  await expect(bruno.getByRole('heading', { name: 'Classe di prova' })).toBeVisible()

  await anna.getByRole('link', { name: 'Gestisci classe' }).click()
  await anna.getByRole('button', { name: 'Elimina classe…' }).click()
  const elimina = anna.getByRole('dialog').getByRole('button', { name: 'Elimina definitivamente' })
  await expect(elimina).toBeDisabled()
  await anna.getByLabel(/Per confermare scrivi/).fill('Classe di')
  await expect(elimina).toBeDisabled()
  await anna.getByLabel(/Per confermare scrivi/).fill('Classe di prova')
  await anna.screenshot({ path: info.outputPath('conferma.png') })
  await elimina.click()

  await expect(anna.getByText('Non sei ancora in nessuna classe')).toBeVisible()
  await expect(bruno.getByRole('heading', { name: 'Non fai parte di questa classe' })).toBeVisible()
  await bruno.goto('/')
  await expect(bruno.getByText('Non sei ancora in nessuna classe')).toBeVisible()
  await bruno.goto(`/unisciti/${codice}`)
  await expect(bruno.getByRole('heading', { name: 'Codice non valido' })).toBeVisible()
})
