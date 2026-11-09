import { expect, test, type Page } from '@playwright/test'
import { accedi, conferma, leggiCodice, svuotaEmulatori } from './aiuti'

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
  await anna.getByRole('main').getByRole('link', { name: /4ªB/ }).click()
  await anna.getByRole('link', { name: 'Materie e calendario' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Storia')
  const giorni = anna.getByRole('group', { name: 'Giorni di lezione' })
  await giorni.getByRole('button', { name: 'martedì' }).click()
  await giorni.getByRole('button', { name: 'giovedì' }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await expect(anna.getByRole('link', { name: 'Storia' })).toBeVisible()
  // Nuova interrogazione direttamente dalla pagina della classe
  await anna.getByRole('main').getByRole('link', { name: /4ªB/ }).click()
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await expect(anna.getByLabel('Materia')).toHaveValue(/.+/)
  await anna.getByLabel('Nome', { exact: true }).fill('Orale Risorgimento')
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('1')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale Risorgimento' })).toBeVisible()

  // Preferenze: Anna inizio, Bruno fine, Carla (DSA) "non mi interessa"
  await anna.getByRole('radio', { name: /Inizio/ }).click()
  await expect(anna.getByText('La tua scelta: inizio')).toBeVisible()

  await apriInterrogazione(bruno, 'Orale Risorgimento')
  await expect(bruno.getByText('Con il badge DSA/BES')).toHaveCount(0)
  await bruno.getByRole('radio', { name: /Fine/ }).click()
  await expect(bruno.getByText('La tua scelta: fine')).toBeVisible()
  await expect(bruno.getByText(/Preferenze ricevute/)).toHaveCount(0) // solo capo e vice

  await apriInterrogazione(carla, 'Orale Risorgimento')
  await expect(carla.getByText('Con il badge DSA/BES')).toBeVisible()
  await carla.getByRole('radio', { name: /Non mi interessa/ }).click()
  await expect(carla.getByText('La tua scelta: non mi interessa')).toBeVisible()

  await apriInterrogazione(rossi, 'Orale Risorgimento')
  await expect(rossi.getByText('Gli studenti stanno scegliendo le preferenze')).toBeVisible()
  await expect(rossi.getByRole('radio')).toHaveCount(0)

  // Anna vede chi ha scelto cosa (e prima ha il promemoria per chi manca)
  await expect(anna.getByText('Messaggio per la classe')).toBeVisible()
  await expect(anna.getByText('Preferenze ricevute (3/3)')).toBeVisible()
  await expect(anna.locator('li', { hasText: 'Non mi interessa' })).toContainText('Carla Blu')
  await expect(anna.getByRole('button', { name: 'Genera lista' })).toHaveCount(0)

  // Anna anticipa la scadenza: le preferenze si chiudono per tutti
  await anna.getByRole('button', { name: 'Modifica' }).click()
  await anna.getByLabel('Scadenza per le preferenze').fill(dataOraLocale(new Date(Date.now() - 60_000)))
  await anna.getByRole('button', { name: 'Salva modifiche' }).click()
  await expect(bruno.getByText(/Le preferenze sono chiuse/)).toBeVisible()
  await expect(bruno.getByRole('radio')).toHaveCount(0)

  // Anna genera la lista
  await anna.getByRole('button', { name: 'Genera lista' }).click()
  await conferma(anna, 'Genera lista')
  const ordine = anna.getByRole('list', { name: 'Ordine delle interrogazioni' })
  await expect(ordine.getByRole('listitem')).toHaveCount(3)
  await expect(ordine.getByRole('listitem').nth(0)).toContainText('Anna Verdi')
  await expect(ordine.getByRole('listitem').nth(1)).toContainText('Carla Blu')
  await expect(ordine.getByRole('listitem').nth(2)).toContainText('Bruno Neri')
  await expect(anna.getByText('Sei il n° 1 di 3')).toBeVisible()
  await anna.getByText('Rapporto (visibile a capoclasse e vice)').click() // sezione a scomparsa
  await expect(anna.getByText('Inizio ottenuto: 1 su 1')).toBeVisible()
  await expect(anna.getByText('Fine ottenuta: 1 su 1')).toBeVisible()

  // Tutti vedono la lista (in tempo reale); la stima della data c'è
  await expect(bruno.getByText('Sei il n° 3 di 3')).toBeVisible()
  await expect(bruno.getByText(/^Stimata: (Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato) \d{2}\/\d{2}$/).first()).toBeVisible()
  await expect(carla.getByText('Sei il n° 2 di 3')).toBeVisible()
  await expect(carla.getByText('Rapporto (visibile a capoclasse e vice)')).toHaveCount(0)
  await expect(rossi.getByRole('list', { name: 'Ordine delle interrogazioni' }).getByRole('listitem')).toHaveCount(3)
  await expect(rossi.getByText(/^Sei il n°/)).toHaveCount(0)
  await expect(rossi.getByText('Rapporto (visibile a capoclasse e vice)')).toHaveCount(0)

  // Bruno condivide la lista: testo copiato e link di WhatsApp
  await bruno.getByRole('button', { name: 'Copia messaggio' }).click()
  const copiato = await bruno.evaluate(() => navigator.clipboard.readText())
  expect(copiato).toContain('*Storia – Orale Risorgimento*')
  expect(copiato).toMatch(/1\. Anna Verdi — Stimata: /)
  expect(copiato).toContain('/interrogazione/')
  await expect(bruno.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=.*Anna%20Verdi/)

  await bruno.screenshot({ path: info.outputPath('lista-studente.png'), fullPage: true })
  await anna.screenshot({ path: info.outputPath('lista-capo.png'), fullPage: true })

  // ── Modifica della lista: il docente senza permesso e gli studenti non possono ──
  await expect(rossi.getByRole('button', { name: 'Modifica la lista' })).toHaveCount(0)
  await expect(bruno.getByRole('button', { name: 'Modifica la lista' })).toHaveCount(0)
  await anna.getByRole('button', { name: 'Modifica la lista' }).click()
  const nuovo = anna.getByRole('list', { name: 'Nuovo ordine' })
  // "Annulla" non cambia niente
  await anna.getByRole('button', { name: 'Manda in fondo Anna Verdi' }).click()
  await expect(nuovo.getByRole('listitem').nth(2)).toContainText('Anna Verdi')
  await anna.getByRole('button', { name: 'Annulla', exact: true }).click()
  await expect(ordine.getByRole('listitem').nth(0)).toContainText('Anna Verdi')
  await anna.getByRole('button', { name: 'Modifica la lista' }).click()
  await expect(anna.getByRole('button', { name: 'Conferma', exact: true })).toBeDisabled() // niente da salvare
  // Carla su di uno con la tastiera (spazio, freccia su, spazio)…
  await anna.getByRole('button', { name: 'Trascina Carla Blu' }).focus()
  // dnd-kit misura le posizioni all'inizio del trascinamento: tra un tasto e l'altro serve un attimo
  for (const tasto of ['Space', 'ArrowUp', 'Space']) {
    await anna.keyboard.press(tasto)
    await anna.waitForTimeout(250)
  }
  await expect(nuovo.getByRole('listitem').nth(0)).toContainText('Carla Blu')
  // …poi "Manda in fondo"
  await anna.getByRole('button', { name: 'Manda in fondo Carla Blu' }).click()
  await expect(nuovo.getByRole('listitem').nth(0)).toContainText('Anna Verdi')
  await expect(nuovo.getByRole('listitem').nth(1)).toContainText('Bruno Neri')
  await expect(nuovo.getByRole('listitem').nth(2)).toContainText('Carla Blu')
  await expect(anna.getByRole('button', { name: 'Manda in fondo Carla Blu' })).toBeDisabled() // è già l'ultima
  await anna.getByRole('button', { name: 'Conferma', exact: true }).click()
  await expect(ordine.getByRole('listitem').nth(0)).toContainText('Anna Verdi')
  await expect(ordine.getByRole('listitem').nth(2)).toContainText('Carla Blu')
  await expect(carla.getByText('Sei il n° 3 di 3')).toBeVisible() // in tempo reale
  await expect(bruno.getByText('Sei il n° 2 di 3')).toBeVisible()

  // Lo storico registra chi ha spostato chi (solo Carla, non chi è scalato di un posto)
  await bruno.getByText(/Storico delle modifiche/).click()
  const storico = bruno.getByRole('list', { name: 'Storico delle modifiche' })
  await expect(storico.getByText('Anna Verdi ha spostato Carla Blu da 2 a 3')).toBeVisible()
  await expect(storico.getByText('Anna Verdi ha generato la lista')).toBeVisible()

  // ── Lezione: proposta Anna (la prima); era "assente", interrogato invece Bruno ──
  const segna = anna.getByRole('region', { name: 'Segna chi è stato interrogato' }).or(anna.locator('section', { hasText: 'Segna chi è stato interrogato' }))
  await expect(segna.getByRole('checkbox', { name: 'Anna Verdi' })).toBeChecked()
  await segna.getByRole('checkbox', { name: 'Anna Verdi' }).uncheck()
  await segna.getByLabel('Interrogato anche qualcun altro?').selectOption({ label: 'Bruno Neri' })
  await segna.getByRole('button', { name: 'Conferma 1 interrogato' }).click()
  await expect(ordine.getByRole('listitem').nth(1)).toContainText('interrogato')
  await expect(bruno.getByText(/Sei stato interrogato/)).toBeVisible()
  await expect(storico.getByText(/Anna Verdi ha segnato Bruno Neri come interrogati/)).toBeVisible()
  // Anna (assente) resta la prima da interrogare: è di nuovo proposta
  await expect(segna.getByRole('checkbox', { name: 'Anna Verdi' })).toBeChecked()
  // capo e vice non hanno "Sono stato interrogato" (si segnano da soli)
  await expect(anna.getByRole('button', { name: 'Sono stato interrogato' })).toHaveCount(0)

  // ── Carla segnala "Sono stato interrogato", Anna conferma ──
  await carla.getByRole('button', { name: 'Sono stato interrogato' }).click()
  await carla.getByRole('button', { name: 'Segnala' }).click()
  await expect(carla.getByText(/in attesa che il capoclasse confermi/)).toBeVisible()
  await expect(anna.getByText(/Carla Blu segnala l'interrogazione di/)).toBeVisible()
  await anna.screenshot({ path: info.outputPath('gestione-lista.png'), fullPage: true })
  await anna.getByRole('button', { name: 'Conferma', exact: true }).click()
  await expect(carla.getByText(/Sei stato interrogato/)).toBeVisible()

  // ── Anna segna sé stessa: interrogazione conclusa ──
  await segna.getByRole('button', { name: 'Conferma 1 interrogato' }).click()
  await expect(anna.getByText('Interrogazione conclusa')).toBeVisible()
  await expect(rossi.getByText('Interrogazione conclusa')).toBeVisible()
  await expect(rossi.getByText('Conclusa', { exact: true })).toBeVisible()

  // ── Annullando un interrogato torna "Lista pronta" ──
  await anna.getByRole('button', { name: 'Annulla interrogato Carla Blu' }).click()
  await expect(anna.getByText('Interrogazione conclusa')).toHaveCount(0)
  await expect(carla.getByText('Sei il n° 3 di 3')).toBeVisible()

  // ... e "Annulla" nel messaggio in basso la rimette interrogata
  await anna.getByRole('button', { name: 'Annulla: Tolto il segno a Carla Blu' }).click()
  await expect(anna.getByText('Interrogazione conclusa')).toBeVisible()
  await expect(carla.getByText(/Sei stato interrogato/)).toBeVisible()
})

test('DSA/BES: si sceglie il giorno, in lista resta fisso; il badge i compagni lo vedono solo se lo studente lo mostra', async ({ browser }, info) => {
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('4ªB')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const classe = new URL(anna.url()).pathname
  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()
  const carla = await accedi(browser, 'carla.blu@studenti.ittsrimini.edu.it', 'Carla Blu', `/unisciti/${codice}`)
  await carla.getByRole('button', { name: 'Entra', exact: true }).click()
  await anna.goto(`${classe}/gestione`)
  await anna.getByRole('listitem').filter({ hasText: 'Carla Blu' }).getByRole('button', { name: 'Dai DSA/BES' }).click()
  await expect(anna.getByRole('listitem').filter({ hasText: 'Carla Blu' }).getByText('DSA/BES', { exact: true })).toBeVisible()
  // di base i compagni non lo vedono
  await bruno.goto(classe)
  await expect(bruno.getByRole('listitem').filter({ hasText: 'Carla Blu' })).toBeVisible()
  await expect(bruno.getByRole('listitem').filter({ hasText: 'Carla Blu' }).getByText('DSA/BES', { exact: true })).toHaveCount(0)

  // Storia tutti i giorni, 1 per lezione
  await anna.goto(`${classe}/configura`)
  await anna.getByLabel('Nome', { exact: true }).fill('Storia')
  const giorni = anna.getByRole('group', { name: 'Giorni di lezione' })
  for (const g of ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì']) await giorni.getByRole('button', { name: g }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await expect(anna.getByRole('link', { name: 'Storia' })).toBeVisible()
  await anna.goto(classe)
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Orale')
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('1')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale' })).toBeVisible()
  const interrogazione = anna.url()

  // Carla sceglie il secondo giorno proposto (mai quello di oggi, in cui è stata creata)
  await carla.goto(interrogazione)
  const scelta = carla.getByLabel("Giorno dell'interrogazione")
  await expect.poll(() => scelta.locator('option').count()).toBeGreaterThanOrEqual(5)
  const opzioni = await scelta.locator('option').allTextContents()
  const oggi = new Date()
  const oggiTesto = `${String(oggi.getDate()).padStart(2, '0')}/${String(oggi.getMonth() + 1).padStart(2, '0')}`
  expect(opzioni.some((o) => o.endsWith(oggiTesto))).toBe(false)
  const giorno = opzioni[1]!
  await scelta.selectOption({ label: giorno })
  await carla.getByRole('button', { name: 'Scegli questa data' }).click()
  await expect(carla.getByText(`La tua scelta: la data di ${giorno.toLowerCase()}`)).toBeVisible()
  await expect(carla.getByRole('button', { name: 'Data scelta' })).toBeVisible()
  await bruno.goto(interrogazione)
  await expect(bruno.getByLabel("Giorno dell'interrogazione")).toHaveCount(0) // senza badge non si sceglie il giorno
  await bruno.getByRole('radio', { name: /Inizio/ }).click()
  await expect(anna.locator('li', { hasText: 'Data scelta' })).toContainText(`Carla Blu (${giorno.toLowerCase()})`)

  // Anna chiude le preferenze e genera
  await anna.getByRole('button', { name: 'Modifica' }).click()
  await anna.getByLabel('Scadenza per le preferenze').fill(dataOraLocale(new Date(Date.now() - 60_000)))
  await anna.getByRole('button', { name: 'Salva modifiche' }).click()
  await anna.getByRole('button', { name: 'Genera lista' }).click()
  await conferma(anna, 'Genera lista')
  const ordine = anna.getByRole('list', { name: 'Ordine delle interrogazioni' })
  await expect(ordine.getByRole('listitem')).toHaveCount(3)
  const rigaCarla = ordine.getByRole('listitem').filter({ hasText: 'Carla Blu' })
  await expect(rigaCarla).toContainText('fissato')
  await expect(rigaCarla).toContainText(`Stimata: ${giorno}`)
  await expect(rigaCarla.getByLabel('data fissa')).toBeVisible() // al posto del numero

  // Carla vede il suo giorno; Bruno e Anna la loro posizione (solo tra chi non ha la data fissa)
  await expect(carla.getByText(`Interrogazione ${giorno.toLowerCase()}`)).toBeVisible()
  await expect(bruno.getByText('Sei il n° 1 di 2')).toBeVisible()
  await expect(anna.getByText('Sei il n° 2 di 2')).toBeVisible()
  // nella modifica della lista chi ha la data fissa non si sposta
  await anna.getByRole('button', { name: 'Modifica la lista' }).click()
  await expect(anna.getByRole('list', { name: 'Nuovo ordine' }).getByRole('listitem')).toHaveCount(2)
  await expect(anna.getByText('Con la data fissa (DSA/BES), non si spostano')).toBeVisible()
  await anna.getByRole('button', { name: 'Annulla', exact: true }).click()

  // Carla mostra il badge e poi lo nasconde di nuovo: Bruno lo vede solo nel frattempo (la data fissa resta), Anna sempre
  const rigaPerBruno = bruno.getByRole('list', { name: 'Ordine delle interrogazioni' }).getByRole('listitem').filter({ hasText: 'Carla Blu' })
  await expect(rigaPerBruno).toContainText('fissato')
  await expect(rigaPerBruno.getByText('DSA/BES', { exact: true })).toHaveCount(0)
  await carla.goto('/impostazioni')
  const interruttore = carla.getByRole('switch', { name: /Mostra il badge ai compagni/ })
  await expect(interruttore).not.toBeChecked()
  await interruttore.check()
  await expect(carla.getByText('Il badge DSA/BES ora è visibile ai compagni')).toBeVisible()
  await expect(rigaPerBruno.getByText('DSA/BES', { exact: true })).toBeVisible()
  await interruttore.uncheck()
  await expect(carla.getByText('Il badge DSA/BES ora è nascosto ai compagni')).toBeVisible()
  await expect(rigaPerBruno.getByText('DSA/BES', { exact: true })).toHaveCount(0)
  await expect(rigaPerBruno).toContainText('fissato')
  await expect(rigaCarla.getByText('DSA/BES', { exact: true })).toBeVisible()
  // Bruno non ha la sezione del badge nelle Impostazioni
  await bruno.goto('/impostazioni')
  await expect(bruno.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()
  await expect(bruno.getByRole('switch', { name: /Mostra il badge/ })).toHaveCount(0)
  await anna.screenshot({ path: info.outputPath('lista-data-fissa.png'), fullPage: true })
})

test('imprevisti: escludere prima, poi rimettere, fissare una data e togliere (solo capo e vice)', async ({ browser }) => {
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('4ªB')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const classe = new URL(anna.url()).pathname
  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', 'Bruno Neri', `/unisciti/${codice}`)
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()
  const carla = await accedi(browser, 'carla.blu@studenti.ittsrimini.edu.it', 'Carla Blu', `/unisciti/${codice}`)
  await carla.getByRole('button', { name: 'Entra', exact: true }).click()
  await anna.goto(`${classe}/configura`)
  await anna.getByLabel('Nome', { exact: true }).fill('Storia')
  const giorni = anna.getByRole('group', { name: 'Giorni di lezione' })
  for (const g of ['lunedì', 'mercoledì', 'venerdì']) await giorni.getByRole('button', { name: g }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await expect(anna.getByRole('link', { name: 'Storia' })).toBeVisible()
  await anna.goto(classe)
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Orale')
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('1')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale' })).toBeVisible()
  const interrogazione = anna.url()

  // Prima della generazione Anna esclude Carla: Carla non può scegliere
  await anna.getByText('Escludi studenti').click()
  const inLista = anna.getByRole('list', { name: 'Studenti in lista' })
  await inLista.getByRole('checkbox', { name: /Carla Blu/ }).uncheck()
  await expect(anna.getByText('Carla Blu escluso da questa interrogazione')).toBeVisible()
  await expect(anna.getByText('Preferenze ricevute (0/2)')).toBeVisible()
  await carla.goto(interrogazione)
  await expect(carla.getByText(/Sei stato escluso da questa interrogazione/)).toBeVisible()
  await expect(carla.getByRole('radio')).toHaveCount(0)
  await bruno.goto(interrogazione)
  await expect(bruno.getByText('Escludi studenti')).toHaveCount(0) // solo capo e vice

  await anna.getByRole('button', { name: 'Modifica' }).click()
  await anna.getByLabel('Scadenza per le preferenze').fill(dataOraLocale(new Date(Date.now() - 60_000)))
  await anna.getByRole('button', { name: 'Salva modifiche' }).click()
  await anna.getByRole('button', { name: 'Genera lista' }).click()
  await conferma(anna, 'Genera lista')
  const ordine = anna.getByRole('list', { name: 'Ordine delle interrogazioni' })
  await expect(ordine.getByRole('listitem')).toHaveCount(2)
  await expect(ordine).not.toContainText('Carla Blu')

  // Imprevisto 1: Carla va rimessa (in fondo)
  await expect(anna.getByText(/Imprevisti: .*\(1 fuori lista\)/)).toBeVisible()
  await anna.getByRole('button', { name: 'Aggiungi in fondo Carla Blu' }).click()
  await expect(ordine.getByRole('listitem')).toHaveCount(3)
  await expect(ordine.getByRole('listitem').nth(2)).toContainText('Carla Blu')
  await expect(carla.getByText('Sei il n° 3 di 3')).toBeVisible()

  // Imprevisto 2: il docente vuole Bruno in un giorno preciso
  await anna.getByRole('button', { name: 'Fissa una data Bruno Neri' }).click()
  const scelta = anna.getByLabel("Giorno dell'interrogazione di Bruno Neri")
  const giorno = (await scelta.locator('option').allTextContents())[2]!
  await scelta.selectOption({ label: giorno })
  await anna.getByRole('button', { name: 'Fissa', exact: true }).click()
  await expect(ordine.getByRole('listitem').filter({ hasText: 'Bruno Neri' })).toContainText('fissato')
  await expect(bruno.getByText(`Interrogazione ${giorno.toLowerCase()}`)).toBeVisible()
  await expect(bruno.getByRole('button', { name: /Fissa una data/ })).toHaveCount(0) // gli studenti non hanno gli imprevisti

  // Carla non ci sarà il giorno previsto: passa alla prima data disponibile, con data fissa
  await carla.getByRole('button', { name: 'Non ci sarò' }).click()
  await conferma(carla, 'Conferma')
  await expect(carla.getByText('Hai una data fissa: resta questa anche se la lista cambia.')).toBeVisible()
  await expect(ordine.getByRole('listitem').filter({ hasText: 'Carla Blu' })).toContainText('fissato')
  await expect(anna.getByRole('button', { name: 'Rimetti in lista Carla Blu' })).toBeVisible()

  // Anna doveva esserci e non si è presentata: passa avanti, con il segnale di attenzione
  const segnaleAnna = ordine.getByRole('listitem').filter({ hasText: 'Anna Verdi' }).getByRole('img', { name: /Assente dopo la scadenza/ })
  await anna.getByRole('button', { name: 'Ha saltato Anna Verdi' }).click()
  await conferma(anna, 'Ha saltato')
  await expect(segnaleAnna).toHaveAccessibleName('Assente dopo la scadenza')
  await anna.getByLabel('Interrogato anche qualcun altro?').selectOption({ label: 'Anna Verdi' })
  await anna.getByRole('button', { name: 'Ha saltato Anna Verdi' }).click()
  await conferma(anna, 'Ha saltato')
  await expect(segnaleAnna).toHaveAccessibleName('Assente dopo la scadenza, 2 volte')
  await expect(segnaleAnna).toContainText('2')

  // Imprevisto 3: Carla si ritira, la si toglie
  await anna.getByRole('button', { name: 'Togli dalla lista Carla Blu' }).click()
  await conferma(anna, 'Togli dalla lista')
  await expect(ordine).not.toContainText('Carla Blu')
  await expect(carla.getByText(/^Sei il n°/)).toHaveCount(0)

  // Tutto nello storico, visibile a tutti
  await bruno.getByText(/Storico delle modifiche/).click()
  const storico = bruno.getByRole('list', { name: 'Storico delle modifiche' })
  await expect(storico.getByText('Anna Verdi ha aggiunto Carla Blu in fondo alla lista')).toBeVisible()
  await expect(storico.getByText(`Anna Verdi ha fissato l'interrogazione di Bruno Neri per ${giorno.toLowerCase()}`)).toBeVisible()
  await expect(storico.getByText('Anna Verdi ha tolto Carla Blu dalla lista')).toBeVisible()
  await expect(storico.getByText(/^Carla Blu ha detto che non ci sarà .*: passa a /)).toBeVisible()
  await expect(storico.getByText(/^Anna Verdi ha segnato che Anna Verdi ha saltato l'interrogazione: passa a /).first()).toBeVisible()

  // Il termine per dirlo si cambia dalla gestione della classe
  await anna.goto(`${classe}/gestione`)
  const termine = anna.getByLabel('Si può dire "non ci sarò" entro quanti giorni prima')
  await expect(termine).toHaveValue('2')
  await termine.fill('4')
  await anna.getByRole('button', { name: 'Salva', exact: true }).click()
  await expect(anna.getByText('Termine aggiornato')).toBeVisible()
  await anna.reload()
  await expect(termine).toHaveValue('4')
})

test('senza lista: nessun ordine; si segnano gli interrogati, chi si segnala aspetta capo o vice; campanella', async ({ browser }) => {
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', 'Anna Verdi')
  await anna.getByLabel('Nome della classe').fill('4ªB')
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const classe = new URL(anna.url()).pathname
  const carla = await accedi(browser, 'carla.blu@studenti.ittsrimini.edu.it', 'Carla Blu', `/unisciti/${codice}`)
  await carla.getByRole('button', { name: 'Entra', exact: true }).click()
  await expect(carla.getByRole('heading', { name: '4ªB' })).toBeVisible()
  await anna.goto(`${classe}/configura`)
  await anna.getByLabel('Nome', { exact: true }).fill('Storia')
  const giorni = anna.getByRole('group', { name: 'Giorni di lezione' })
  for (const g of ['lunedì', 'mercoledì', 'venerdì']) await giorni.getByRole('button', { name: g }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await expect(anna.getByRole('link', { name: 'Storia' })).toBeVisible()
  await anna.goto(classe)
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Orale libero')
  await anna.getByRole('switch', { name: /Usa lista/ }).uncheck()
  await expect(anna.getByLabel('Scadenza per le preferenze')).toHaveCount(0)
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: 'Orale libero' })).toBeVisible()
  await expect(anna.getByText('In corso', { exact: true })).toBeVisible()
  await expect(anna.getByRole('button', { name: 'Modifica la lista' })).toHaveCount(0)
  const interrogazione = anna.url()

  await carla.goto(interrogazione)
  await expect(carla.getByText('Non ancora interrogato')).toBeVisible()
  await expect(carla.getByRole('radio')).toHaveCount(0)
  await expect(carla.getByRole('button', { name: 'Scambia' })).toHaveCount(0)
  await carla.getByRole('button', { name: 'Sono stato interrogato' }).click()
  await carla.getByRole('button', { name: 'Segnala' }).click()
  await expect(carla.getByText(/in attesa che il capoclasse confermi/)).toBeVisible()
  await expect(anna.getByText(/Carla Blu segnala l'interrogazione di/)).toBeVisible()
  await anna.getByRole('button', { name: 'Conferma', exact: true }).click()
  await expect(carla.getByText(/Sei stato interrogato/)).toBeVisible()

  // Notification Box: una notifica scritta dal server compare in tempo reale, si apre e diventa letta
  const utenti = (await (
    await fetch('http://127.0.0.1:8080/v1/projects/demo-whosnext/databases/(default)/documents/users', { headers: { Authorization: 'Bearer owner' } })
  ).json()) as { documents: { name: string; fields: { email?: { stringValue: string } } }[] }
  const percorsoAnna = utenti.documents.find((d) => d.fields.email?.stringValue.startsWith('anna'))!.name
  const risposta = await fetch(`http://127.0.0.1:8080/v1/${percorsoAnna}/notifiche?documentId=n1`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        titolo: { stringValue: 'Da confermare: Carla interrogato' },
        testo: { stringValue: 'Apri per confermare.' },
        link: { stringValue: classe },
        quando: { timestampValue: new Date().toISOString() },
        letta: { booleanValue: false },
      },
    }),
  })
  expect(risposta.ok).toBe(true)
  await anna.getByRole('button', { name: 'Notifiche (1 non lette)' }).click()
  await anna.getByRole('dialog', { name: 'Notifiche' }).getByRole('button', { name: /Da confermare: Carla interrogato/ }).click()
  await expect(anna).toHaveURL(new RegExp(`${classe}$`))
  await expect(anna.getByRole('button', { name: 'Notifiche', exact: true })).toBeVisible()
})
