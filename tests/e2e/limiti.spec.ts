import { expect, test, type Page } from '@playwright/test'
import { accedi, conferma, leggiCodice, svuotaEmulatori } from './aiuti'

// Casi limite nel browser: nomi lunghissimi e con caratteri "pericolosi", schermi stretti,
// indirizzi sbagliati. In ogni pagina: niente codice eseguito, niente errori, niente scorrimento orizzontale.

test.setTimeout(180_000)

// HTML e script nei nomi: devono comparire come testo, mai essere eseguiti
const TRAPPOLA = `<img src=x onerror="window.__xss=1">`
const NOME_LUNGO = `Annamaria Sofia Lunghissimonomedifamiglia ${TRAPPOLA} 😀 D'Alessandro`.slice(0, 100)
const CLASSE = `5ªB "Informatica" ${TRAPPOLA} con un nome davvero lunghissimo`.slice(0, 60)
const MATERIA = `Tecnologie e progettazione ${TRAPPOLA}`.slice(0, 40)
const INTERR = `Orale <script>window.__xss=2</script> sul capitolo dodicesimo`.slice(0, 60)

/** Raccoglie gli errori JavaScript della pagina. */
function sorvegliaErrori(page: Page): string[] {
  const errori: string[] = []
  page.on('pageerror', (e) => errori.push(e.message))
  page.on('dialog', (d) => {
    errori.push(`finestra inattesa: ${d.message()}`)
    void d.dismiss()
  })
  return errori
}

/** Nessuno scorrimento orizzontale e nessun codice eseguito, anche su un telefono stretto (320 px). */
async function controllaPagina(page: Page, dove: string) {
  for (const larghezza of [320, 412]) {
    await page.setViewportSize({ width: larghezza, height: 800 })
    await page.waitForTimeout(250)
    const { scorre, larga } = await page.evaluate(() => {
      const d = document.documentElement
      // l'elemento più largo dello schermo, per capire cosa sfora
      let larga = ''
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.right > d.clientWidth + 1 && getComputedStyle(el).position !== 'fixed') {
          larga = `${el.tagName}.${(el.getAttribute('class') ?? '').slice(0, 60)} → ${Math.round(r.right)}px`
          break
        }
      }
      return { scorre: d.scrollWidth > d.clientWidth + 1, larga }
    })
    expect(scorre, `${dove} a ${larghezza}px scorre di lato: ${larga}`).toBe(false)
  }
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss), `${dove}: codice eseguito`).toBeUndefined()
}

test('nomi lunghissimi e con codice dentro: mostrati come testo, senza rompere la pagina', async ({ browser }) => {
  await svuotaEmulatori()
  const anna = await accedi(browser, 'anna.verdi@studenti.ittsrimini.edu.it', NOME_LUNGO)
  const errori = sorvegliaErrori(anna)
  await controllaPagina(anna, 'home vuota')

  await anna.getByLabel('Nome della classe').fill(CLASSE)
  await anna.getByRole('button', { name: 'Crea classe' }).click()
  const codice = await leggiCodice(anna)
  const classe = new URL(anna.url()).pathname
  await expect(anna.getByRole('heading', { name: CLASSE })).toBeVisible()
  await controllaPagina(anna, 'classe')

  const bruno = await accedi(browser, 'bruno.neri@studenti.ittsrimini.edu.it', `Bruno ${TRAPPOLA}`, `/unisciti/${codice}`)
  const erroriBruno = sorvegliaErrori(bruno)
  await expect(bruno.getByText(CLASSE)).toBeVisible()
  await controllaPagina(bruno, 'unisciti')
  await bruno.getByRole('button', { name: 'Entra', exact: true }).click()

  await anna.goto(`${classe}/configura`)
  await anna.getByLabel('Nome', { exact: true }).fill(MATERIA)
  await anna.getByRole('group', { name: 'Giorni di lezione' }).getByRole('button', { name: 'lunedì' }).click()
  await anna.getByRole('button', { name: 'Aggiungi materia' }).click()
  await expect(anna.getByRole('link', { name: MATERIA })).toBeVisible()
  await controllaPagina(anna, 'configura')
  for (const scheda of ['Orario', 'Calendario']) {
    await anna.getByRole('tab', { name: scheda }).click()
    await controllaPagina(anna, `configura/${scheda}`)
  }

  await anna.goto(classe)
  await anna.getByRole('button', { name: 'Nuova interrogazione' }).click()
  await anna.getByLabel('Materia').selectOption({ label: MATERIA })
  await anna.getByLabel('Nome', { exact: true }).fill(INTERR)
  await anna.getByLabel('Descrizione (facoltativa)').fill(`${TRAPPOLA} ${'parola '.repeat(60)}`.slice(0, 500))
  await anna.getByLabel('Interrogati per lezione (facoltativo)').fill('1')
  await anna.getByRole('button', { name: 'Crea interrogazione' }).click()
  await expect(anna.getByRole('heading', { name: INTERR })).toBeVisible()
  await controllaPagina(anna, 'interrogazione in raccolta')

  // lista generata: nomi lunghi in ogni riga
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
  await expect(anna.getByRole('list', { name: 'Ordine delle interrogazioni' }).getByRole('listitem')).toHaveCount(2)
  await controllaPagina(anna, 'lista (capo)')
  await bruno.goto(anna.url())
  await expect(bruno.getByText(/Sei il n°/)).toBeVisible()
  await controllaPagina(bruno, 'lista (studente)')

  for (const [p, dove] of [
    [anna, '/'],
    [anna, '/impostazioni'],
    [anna, `${classe}/gestione`],
    [bruno, '/'],
    [bruno, classe],
  ] as const) {
    await p.goto(dove)
    // Firestore tiene la connessione aperta: si aspetta che la pagina abbia il suo titolo
    await expect(p.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await p.waitForTimeout(600)
    await controllaPagina(p, dove)
  }
  // il testo "pericoloso" si vede proprio come testo
  await bruno.goto(classe)
  await expect(bruno.getByText(CLASSE).first()).toBeVisible()
  expect(errori).toEqual([])
  expect(erroriBruno).toEqual([])
})

test('indirizzi sbagliati o di classi altrui: un messaggio chiaro, mai una pagina bianca', async ({ browser }) => {
  const carla = await accedi(browser, 'carla.blu@studenti.ittsrimini.edu.it', 'Carla Blu')
  const errori = sorvegliaErrori(carla)
  // una classe che non esiste o di cui non si fa parte
  await carla.goto('/classe/nonesiste')
  await expect(carla.getByRole('heading', { name: 'Non fai parte di questa classe' })).toBeVisible()
  await carla.goto('/classe/nonesiste/materia/x/interrogazione/y')
  await expect(carla.getByText(/Non fai parte di questa classe|non trovata/).first()).toBeVisible()
  // un codice d'invito che non esiste
  await carla.goto('/unisciti/ZZZZZZ')
  await expect(carla.getByText(/non (è valido|esiste)|non valido|scaduto/i).first()).toBeVisible()
  // un codice scritto male
  await carla.goto('/unisciti/abc')
  await expect(carla.locator('main')).not.toBeEmpty()
  // una pagina qualsiasi torna alla home
  await carla.goto('/pagina/che/non/esiste')
  await expect(carla).toHaveURL(/\/$/)
  await expect(carla.getByRole('heading', { name: /, Carla$/ })).toBeVisible()
  expect(errori).toEqual([])
})
