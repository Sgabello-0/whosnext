import { beforeEach, describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { database } from '../../netlify/lib/admin'
import { avvisaEsitoScambio, avvisaListaPronta, avvisaRichiestaScambio, ricordaDomani, ricordaScelte } from '../../netlify/lib/eventi'
import { generaScadute } from '../../netlify/lib/generazione'
import { htmlEmail, testoEmail } from '../../netlify/lib/email'
import type { Postino } from '../../netlify/lib/postino'
import type { Notifica } from '../../netlify/lib/testi'

const db = database()
const R = { classId: 'c1', subjectId: 's1', interrogazioneId: 'i1' }
const INTERR = 'classes/c1/subjects/s1/interrogations/i1'
// lunedì 09/11/2026 alle 19:00 in Italia
const LUNEDI_SERA = new Date('2026-11-09T18:00:00Z')

type Mandata = { uid?: string; tokens?: string[]; email?: string; n?: Notifica; oggetto?: string }

/** Postino finto: tiene traccia di cosa avrebbe mandato. Il token "scaduto" risulta non più valido. */
function postinoFinto() {
  const push: { tokens: string[]; n: Notifica }[] = []
  const email: { a: string; oggetto: string; testo: string; html: string }[] = []
  const p: Postino = {
    async push(tokens, n) {
      push.push({ tokens, n })
      return tokens.filter((t) => t === 'scaduto')
    },
    async email(a, e) {
      email.push({ a, oggetto: e.oggetto, testo: testoEmail(e), html: htmlEmail(e) })
    },
  }
  return { p, push, email }
}

async function svuota() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-whosnext/databases/(default)/documents`, {
    method: 'DELETE',
  })
}

/** Classe con Anna (capo), Bruno, Carla e il prof. Rossi; Storia il martedì; un'interrogazione. */
async function classe(interrogazione: Record<string, unknown>) {
  const membri = {
    anna: { ruolo: 'capo', nome: 'Anna Verdi' },
    bruno: { ruolo: 'studente', nome: 'Bruno Neri' },
    carla: { ruolo: 'studente', nome: 'Carla Blu' },
    rossi: { ruolo: 'docente', nome: 'Prof Rossi' },
  }
  for (const [uid, m] of Object.entries(membri)) {
    await db.doc(`classes/c1/members/${uid}`).set({ uid, ...m })
    await db.doc(`users/${uid}`).set({
      nome: m.nome,
      email: `${uid}@studenti.ittsrimini.edu.it`,
      fcmTokens: [`token-${uid}`],
      impostazioni: { autoRifiutaScambi: false, notificheEmail: true, notifichePush: true },
    })
  }
  await db.doc('classes/c1').set({ nome: '4ªB', capoclasseUid: 'anna' })
  await db.doc('classes/c1/subjects/s1').set({ nome: 'Storia', orario: [1] })
  await db.doc(INTERR).set({
    nome: 'Orale',
    descrizione: '',
    giorni: [1],
    perLezione: 1,
    stato: 'raccolta',
    scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    ...interrogazione,
  })
}

beforeEach(svuota)

describe('generazione automatica', () => {
  it('genera le liste scadute una volta sola, con lo storico "automatico"', async () => {
    await classe({})
    await db.doc(`${INTERR}/preferences/bruno`).set({ scelta: 'inizio', posizioneDSA: null, aggiornato: Timestamp.now() })
    expect(await generaScadute(db, new Date())).toEqual([R])
    const lista = (await db.doc(`${INTERR}/list/current`).get()).data()!
    expect(lista.ordine).toHaveLength(3) // il docente non c'è
    expect(lista.ordine[0]).toBe('bruno') // ha chiesto l'inizio
    expect(lista.generataDa).toBe('automatico')
    expect((await db.doc(INTERR).get()).data()!.stato).toBe('lista')
    const voce = (await db.doc(`${INTERR}/storico/${lista.ultimaModifica}`).get()).data()!
    expect(voce).toMatchObject({ tipo: 'generata', chi: 'automatico' })
    expect((await db.doc(`${INTERR}/list/rapporto`).get()).exists).toBe(true)
    // la seconda volta non c'è più niente da fare
    expect(await generaScadute(db, new Date())).toEqual([])
  })

  it('non tocca quelle ancora aperte', async () => {
    await classe({ scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() + 3_600_000)) })
    expect(await generaScadute(db, new Date())).toEqual([])
    expect((await db.doc(INTERR).get()).data()!.stato).toBe('raccolta')
  })
})

describe('avvisi', () => {
  async function conLista(ordine = ['anna', 'bruno', 'carla']) {
    await classe({ stato: 'lista' })
    await db.doc(`${INTERR}/list/current`).set({ ordine, interrogati: {}, generataDa: 'anna' })
  }

  it('lista pronta: a ognuno la sua posizione, push ed email, una volta sola', async () => {
    await conLista()
    await db.doc('users/carla').update({ 'impostazioni.notificheEmail': false, fcmTokens: ['token-carla', 'scaduto'] })
    await db.doc('users/bruno').update({ 'impostazioni.notifichePush': false })
    const { p, push, email } = postinoFinto()
    expect(await avvisaListaPronta(db, p, R, LUNEDI_SERA)).toBe(3)
    expect(push.map((x) => x.tokens)).toEqual([['token-anna'], ['token-carla', 'scaduto']]) // Bruno ha spento le push
    expect(push[0]!.n).toMatchObject({
      titolo: 'Storia – Orale: lista pubblicata',
      testo: 'Sei il n° 1 di 3. Stimata: Martedì 10/11.',
      percorso: '/classe/c1/materia/s1/interrogazione/i1',
    })
    expect(email.map((e) => e.a)).toEqual(['anna@studenti.ittsrimini.edu.it', 'bruno@studenti.ittsrimini.edu.it']) // Carla no
    expect(email[0]!.testo).toContain('Apri la lista: https://whos-next.web.app/classe/c1/materia/s1/interrogazione/i1')
    expect(email[0]!.testo).toContain('Sei il n° 1 di 3.')
    expect(email[0]!.html).toContain('<strong style="color:#0f172a">n° 1 di 3</strong>')
    expect(email[0]!.html).toContain('href="https://whos-next.web.app/classe/c1/materia/s1/interrogazione/i1"')
    // il token non più valido viene tolto
    expect((await db.doc('users/carla').get()).data()!.fcmTokens).toEqual(['token-carla'])
    // rifarlo non manda niente
    expect(await avvisaListaPronta(db, p, R, LUNEDI_SERA)).toBe(0)
    expect(push).toHaveLength(2)
  })

  it('scambi: la richiesta a chi occupa la posizione, l\'esito a chi l\'ha chiesta; solo se a chiamare è la persona giusta', async () => {
    await conLista()
    const rifS = db.doc(`${INTERR}/scambi/carla_0`)
    await rifS.set({ da: 'carla', daPos: 2, aPos: 0, stato: 'attesa', a: null, creato: Timestamp.now(), aggiornato: Timestamp.now() })
    const { p, push, email } = postinoFinto()
    expect(await avvisaRichiestaScambio(db, p, R, 'carla_0', 'bruno')).toBe('non-valido') // non è sua
    expect(await avvisaRichiestaScambio(db, p, R, 'carla_0', 'carla')).toBe('mandata')
    expect(await avvisaRichiestaScambio(db, p, R, 'carla_0', 'carla')).toBe('gia-mandata')
    expect(push).toHaveLength(1)
    expect(push[0]!.tokens).toEqual(['token-anna'])
    expect(push[0]!.n.titolo).toBe('Richiesta di scambio da Carla')
    expect(push[0]!.n.testo).toContain('passeresti dal n° 1 al n° 3')
    expect(email).toHaveLength(1)

    expect(await avvisaEsitoScambio(db, p, R, 'carla_0', 'anna')).toBe('non-valido') // non ha ancora risposto
    await rifS.update({ stato: 'rifiutato', a: 'anna', aggiornato: Timestamp.now() })
    expect(await avvisaEsitoScambio(db, p, R, 'carla_0', 'carla')).toBe('non-valido')
    expect(await avvisaEsitoScambio(db, p, R, 'carla_0', 'anna')).toBe('mandata')
    expect(push[1]).toMatchObject({ tokens: ['token-carla'], n: { titolo: 'Scambio rifiutato da Anna' } })
    expect(email).toHaveLength(1) // l'esito solo come push
  })

  it('promemoria per scegliere: a chi non ha scelto, se la scadenza è entro 6 ore', async () => {
    const tra3ore = new Date(Date.now() + 3 * 3_600_000)
    await classe({ scadenzaPreferenze: Timestamp.fromDate(tra3ore) })
    await db.doc(`${INTERR}/preferences/anna`).set({ scelta: 'fine', posizioneDSA: null, aggiornato: Timestamp.now() })
    const { p, push } = postinoFinto()
    expect(await ricordaScelte(db, p, new Date())).toBe(2) // Bruno e Carla (non il docente, non Anna)
    expect(push.map((x) => x.tokens[0])).toEqual(['token-bruno', 'token-carla'])
    expect(push[0]!.n.titolo).toMatch(/^Preferenza da indicare entro le \d{2}:\d{2}$/)
    expect(await ricordaScelte(db, p, new Date())).toBe(0)
    // troppo presto: niente
    await svuota()
    await classe({ scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() + 24 * 3_600_000)) })
    expect(await ricordaScelte(db, postinoFinto().p, new Date())).toBe(0)
  })

  it('"domani tocca a te": la sera, solo a chi ha la data stimata domani', async () => {
    await conLista()
    const { p, push } = postinoFinto()
    expect(await ricordaDomani(db, p, new Date('2026-11-09T14:00:00Z'))).toBe(0) // pomeriggio: non ancora
    expect(await ricordaDomani(db, p, LUNEDI_SERA)).toBe(1)
    expect(push[0]).toMatchObject({
      tokens: ['token-anna'],
      n: { titolo: 'Interrogazione prevista per domani', testo: 'Storia – Orale (martedì 10/11): sei il n° 1.' },
    })
    expect(await ricordaDomani(db, p, new Date('2026-11-09T19:30:00Z'))).toBe(0) // già avvisata
  })
})
