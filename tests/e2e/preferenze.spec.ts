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
  await anna.getByRole('link', { name: /4ªB/ }).click()
  await anna.getByRole('link', { name: 'Materie e calendario' }).click()
  await anna.getByLabel('Nome', { exact: true }).fill('Storia')
  const giorni = anna.getByRole('group', { name: 'Giorni di lezione' })
  await giorni.getByRole('button', { name: 'martedì' }).click()
  await giorni.getByRole('button', { name: 'giovedì' }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await expect(anna.getByRole('link', { name: 'Storia' })).toBeVisible()
  // Nuova interrogazione direttamente dalla pagina della classe
  await anna.getByRole('link', { name: /4ªB/ }).click()
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await expect(anna.getByLabel('Materia')).toHaveValue(/.+/)
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

  // Anna vede chi ha scelto cosa (e prima ha il promemoria per chi manca)
  await expect(anna.getByText('Messaggio per la classe')).toBeVisible()
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
  await anna.getByRole('button', { name: 'Genera lista' }).click()
  await conferma(anna, 'Genera lista')
  const ordine = anna.getByRole('list', { name: 'Ordine delle interrogazioni' })
  await expect(ordine.getByRole('listitem')).toHaveCount(3)
  await expect(ordine.getByRole('listitem').nth(0)).toContainText('Carla Blu')
  await expect(ordine.getByRole('listitem').nth(1)).toContainText('Anna Verdi')
  await expect(ordine.getByRole('listitem').nth(2)).toContainText('Bruno Neri')
  await expect(anna.getByText('Sei il n° 2 di 3')).toBeVisible()
  await anna.getByText('Rapporto (visibile a capoclasse e vice)').click() // sezione a scomparsa
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

  // Bruno condivide la lista: testo copiato e link di WhatsApp
  await bruno.getByRole('button', { name: 'Copia messaggio' }).click()
  const copiato = await bruno.evaluate(() => navigator.clipboard.readText())
  expect(copiato).toContain('*Storia – Orale Risorgimento*')
  expect(copiato).toMatch(/1\. Carla Blu — Stimata: /)
  expect(copiato).toContain('/interrogazione/')
  await expect(bruno.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=.*Carla%20Blu/)

  await bruno.screenshot({ path: info.outputPath('lista-studente.png'), fullPage: true })
  await anna.screenshot({ path: info.outputPath('lista-capo.png'), fullPage: true })

  // ── Riordino: il docente senza permesso non può; Anna sposta Carla giù con la freccia ──
  await expect(rossi.getByRole('button', { name: 'Riordina' })).toHaveCount(0)
  await expect(bruno.getByRole('button', { name: 'Riordina' })).toHaveCount(0)
  await anna.getByRole('button', { name: 'Riordina' }).click()
  await anna.getByRole('button', { name: 'Sposta giù Carla Blu' }).click()
  const nuovo = anna.getByRole('list', { name: 'Nuovo ordine' })
  await expect(nuovo.getByRole('listitem').nth(0)).toContainText('Anna Verdi')
  // ... e Bruno su di uno con la tastiera (spazio, freccia su, spazio)
  await anna.getByRole('button', { name: 'Trascina Bruno Neri' }).focus()
  // dnd-kit misura le posizioni all'inizio del trascinamento: tra un tasto e l'altro serve un attimo
  for (const tasto of ['Space', 'ArrowUp', 'Space']) {
    await anna.keyboard.press(tasto)
    await anna.waitForTimeout(250)
  }
  await expect(nuovo.getByRole('listitem').nth(1)).toContainText('Bruno Neri')
  await expect(nuovo.getByRole('listitem').nth(2)).toContainText('Carla Blu')
  await anna.getByRole('button', { name: 'Salva ordine' }).click()
  await expect(ordine.getByRole('listitem').nth(0)).toContainText('Anna Verdi')
  await expect(carla.getByText('Sei il n° 3 di 3')).toBeVisible() // in tempo reale
  await expect(bruno.getByText('Sei il n° 2 di 3')).toBeVisible()

  // Lo storico registra chi ha spostato chi (solo Carla, non chi è scalato di un posto)
  await bruno.getByText(/Storico delle modifiche/).click()
  const storico = bruno.getByRole('list', { name: 'Storico delle modifiche' })
  await expect(storico.getByText('Anna Verdi ha spostato Carla Blu da 1 a 3')).toBeVisible()
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
