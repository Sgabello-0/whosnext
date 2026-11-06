/**
 * Casi difficili per il server: esecuzioni in contemporanea, dati strani, confini di orario,
 * date fisse DSA/BES, e gli indirizzi /api/notifica e /api/feedback
 * (controlli su origine, token, dati e iscrizione alla classe).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { database } from '../../netlify/lib/admin'
import { avvisaListaPronta, avvisaNuovaInterrogazione, ricordaDomani } from '../../netlify/lib/eventi'
import { riceviFeedback, type MessaggioFeedback } from '../../netlify/lib/feedback'
import { generaScadute } from '../../netlify/lib/generazione'
import { avvisa, type Postino } from '../../netlify/lib/postino'
import type { Notifica } from '../../netlify/lib/testi'
import feedback from '../../netlify/functions/feedback.mjs'
import notifica from '../../netlify/functions/notifica.mjs'

const db = database()
const R = { classId: 'c1', subjectId: 's1', interrogazioneId: 'i1' }
const CLASSE = 'classes/c1'
const INTERR = 'classes/c1/subjects/s1/interrogations/i1'
// lunedì 09/11/2026 alle 19:00 in Italia (UTC+1)
const LUNEDI_SERA = new Date('2026-11-09T18:00:00Z')

function postinoFinto(o: { rotto?: boolean } = {}) {
  const push: { tokens: string[]; n: Notifica }[] = []
  const p: Postino = {
    async push(tokens, n) {
      if (o.rotto) throw new Error('FCM non risponde')
      push.push({ tokens, n })
      return []
    },
    async email() {},
  }
  return { p, push }
}

async function svuota() {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-whosnext/databases/(default)/documents`, {
    method: 'DELETE',
  })
}

type Membro = { ruolo: 'capo' | 'vice' | 'studente' | 'docente'; nome: string }

async function classe(membri: Record<string, Membro>, interrogazione: Record<string, unknown> = {}, o: { token?: boolean } = {}) {
  for (const [uid, m] of Object.entries(membri)) {
    await db.doc(`${CLASSE}/members/${uid}`).set({ uid, ...m })
    await db.doc(`users/${uid}`).set({
      nome: m.nome,
      email: `${uid}@studenti.ittsrimini.edu.it`,
      fcmTokens: o.token === false ? [] : [`token-${uid}`],
      impostazioni: { autoRifiutaScambi: false, notificheEmail: true, notifichePush: true },
    })
  }
  await db.doc(CLASSE).set({ nome: '4ªB', capoclasseUid: 'anna' })
  await db.doc('classes/c1/subjects/s1').set({ nome: 'Storia', orario: [1, 3] })
  await db.doc(INTERR).set({
    nome: 'Orale',
    descrizione: '',
    giorni: [1, 3],
    perLezione: 1,
    stato: 'raccolta',
    scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    ...interrogazione,
  })
}

const TRE: Record<string, Membro> = {
  anna: { ruolo: 'capo', nome: 'Anna Verdi' },
  bruno: { ruolo: 'studente', nome: 'Bruno Neri' },
  carla: { ruolo: 'studente', nome: 'Carla Blu' },
}

async function conLista(
  ordine: string[],
  extra: Record<string, unknown> = {},
  interrogati: Record<string, string> = {},
  fissi: Record<string, string> = {},
) {
  await classe(TRE, { stato: 'lista', ...extra })
  await db.doc(`${INTERR}/list/current`).set({ ordine, fissi, interrogati, generataDa: 'anna' })
}

beforeEach(svuota)

describe('generazione automatica: casi difficili', () => {
  it('due esecuzioni insieme generano la lista una volta sola', async () => {
    await classe(TRE)
    const [a, b] = await Promise.all([generaScadute(db, new Date()), generaScadute(db, new Date())])
    expect(a.length + b.length).toBe(1)
    const storico = await db.collection(`${INTERR}/storico`).get()
    expect(storico.size).toBe(1)
    const lista = (await db.doc(`${INTERR}/list/current`).get()).data()!
    expect([...lista.ordine].sort()).toEqual(['anna', 'bruno', 'carla'])
    expect(lista.ultimaModifica).toBe(storico.docs[0]!.id)
  })

  it('una classe con soli docenti: lista vuota, nessun avviso', async () => {
    await classe({ rossi: { ruolo: 'docente', nome: 'Prof Rossi' } })
    expect(await generaScadute(db, new Date())).toEqual([R])
    expect((await db.doc(`${INTERR}/list/current`).get()).data()!.ordine).toEqual([])
    expect(await avvisaListaPronta(db, postinoFinto().p, R, new Date())).toBe(0)
  })

  it('il giorno scelto dai DSA vale anche quando genera il server; chi è uscito non c\'è', async () => {
    await classe(TRE)
    await db.doc(`${CLASSE}/dsa/carla`).set({ impostatoDa: 'anna', visibile: true })
    await db.doc(`${INTERR}/preferences/carla`).set({ scelta: 'data', dataDSA: '2026-11-12', aggiornato: Timestamp.now() })
    await db.doc(`${INTERR}/preferences/uscito`).set({ scelta: 'inizio', dataDSA: null, aggiornato: Timestamp.now() })
    // Bruno chiede una data senza badge: non vale
    await db.doc(`${INTERR}/preferences/bruno`).set({ scelta: 'data', dataDSA: '2026-11-10', aggiornato: Timestamp.now() })
    await generaScadute(db, new Date())
    const lista = (await db.doc(`${INTERR}/list/current`).get()).data()!
    expect(lista.fissi).toEqual({ carla: '2026-11-12' })
    expect([...lista.ordine].sort()).toEqual(['anna', 'bruno'])
    expect(lista.ordine).not.toContain('uscito')
  })

  it('una preferenza con un valore sconosciuto non blocca la generazione (conta come "non mi interessa")', async () => {
    await classe(TRE)
    await db.doc(`${INTERR}/preferences/bruno`).set({ scelta: 'boh', posizioneDSA: null, aggiornato: Timestamp.now() })
    expect(await generaScadute(db, new Date())).toEqual([R])
    expect((await db.doc(`${INTERR}/list/current`).get()).data()!.ordine).toHaveLength(3)
  })

  it('un\'interrogazione rovinata non ferma le altre', async () => {
    await classe(TRE)
    // seconda interrogazione, scaduta, in un'altra materia
    await db.doc('classes/c1/subjects/s2').set({ nome: 'Arte', orario: [2] })
    await db.doc('classes/c1/subjects/s2/interrogations/i2').set({
      nome: 'Orale 2',
      giorni: [2],
      perLezione: 1,
      stato: 'raccolta',
      scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    })
    // dato rovinato nella prima: il calcolo non deve far saltare la seconda
    await db.doc(`${INTERR}/preferences/bruno`).set({ scelta: { strano: true }, aggiornato: 'ieri' })
    const fatte = await generaScadute(db, new Date())
    expect(fatte).toContainEqual({ classId: 'c1', subjectId: 's2', interrogazioneId: 'i2' })
  })

  it('non genera le interrogazioni già in lista, anche se scadute', async () => {
    await conLista(['bruno', 'anna', 'carla'])
    expect(await generaScadute(db, new Date())).toEqual([])
    expect((await db.doc(`${INTERR}/list/current`).get()).data()!.ordine).toEqual(['bruno', 'anna', 'carla'])
  })
})

describe('avvisi: casi difficili', () => {
  it('lista pronta: niente se l\'interrogazione è ancora aperta, non esiste o non ha la lista', async () => {
    await classe(TRE)
    const { p, push } = postinoFinto()
    expect(await avvisaListaPronta(db, p, R, new Date())).toBe(0)
    expect(await avvisaListaPronta(db, p, { ...R, interrogazioneId: 'nessuna' }, new Date())).toBe(0)
    await db.doc(INTERR).update({ stato: 'lista' })
    expect(await avvisaListaPronta(db, p, R, new Date())).toBe(0)
    expect(push).toHaveLength(0)
  })

  it('lista generata con una data fissa: a chi ce l\'ha, la data al posto del numero', async () => {
    // Carla ha scelto giovedì 12/11; Anna e Bruno in ordine (1 per lezione, martedì e giovedì)
    await conLista(['anna', 'bruno'], {}, {}, { carla: '2026-11-12' })
    const { p, push } = postinoFinto()
    expect(await avvisaListaPronta(db, p, R, LUNEDI_SERA)).toBe(3)
    const per = Object.fromEntries(push.map((x) => [x.tokens[0], x.n.testo]))
    expect(per['token-anna']).toBe('Sei il n° 1 di 2. Stimata: Martedì 10/11.')
    expect(per['token-carla']).toBe('Hai la data che hai scelto. Stimata: Giovedì 12/11.')
    // giovedì è di Carla: Bruno passa a martedì 17/11
    expect(per['token-bruno']).toBe('Sei il n° 2 di 2. Stimata: Martedì 17/11.')
  })

  it('chi ha spento le push non le riceve, ma l\'avviso conta come gestito', async () => {
    await conLista(['anna', 'bruno', 'carla'])
    for (const u of ['anna', 'bruno', 'carla']) await db.doc(`users/${u}`).update({ 'impostazioni.notifichePush': false })
    const { p, push } = postinoFinto()
    await avvisaListaPronta(db, p, R, new Date())
    expect(push).toHaveLength(0)
    expect(await avvisaListaPronta(db, p, R, new Date())).toBe(0)
  })

  it('utente senza profilo o senza dispositivi: nessun errore', async () => {
    const { p, push } = postinoFinto()
    expect(await avvisa(db, p, 'fantasma', 'prova/1', { titolo: 't', testo: 't', percorso: '/' })).toBe('nessun-utente')
    await db.doc('users/vuoto').set({ nome: 'Vuoto' })
    expect(await avvisa(db, p, 'vuoto', 'prova/2', { titolo: 't', testo: 't', percorso: '/' })).toBe('mandata')
    expect(push).toHaveLength(0)
  })

  it('se l\'invio della push fallisce, l\'avviso si potrà riprovare (non resta segnato come mandato)', async () => {
    await db.doc('users/anna').set({ nome: 'Anna', fcmTokens: ['token-anna'] })
    const n = { titolo: 't', testo: 't', percorso: '/' }
    await expect(avvisa(db, postinoFinto({ rotto: true }).p, 'anna', 'prova/3', n)).rejects.toThrow()
    const { p, push } = postinoFinto()
    expect(await avvisa(db, p, 'anna', 'prova/3', n)).toBe('mandata')
    expect(push).toHaveLength(1)
  })

  it('nuova interrogazione: solo se a chiederlo è chi l\'ha creata, finché le preferenze sono aperte', async () => {
    const tra1ora = Timestamp.fromDate(new Date(Date.now() + 3_600_000))
    await classe({ ...TRE, rossi: { ruolo: 'docente', nome: 'Prof Rossi' } }, { scadenzaPreferenze: tra1ora, creatoDa: 'anna' })
    const { p, push } = postinoFinto()
    expect(await avvisaNuovaInterrogazione(db, p, R, 'bruno', new Date())).toBe('non-valido')
    expect(await avvisaNuovaInterrogazione(db, p, { ...R, interrogazioneId: 'nessuna' }, 'anna', new Date())).toBe('non-valido')
    // scaduta: niente
    expect(await avvisaNuovaInterrogazione(db, p, R, 'anna', new Date(Date.now() + 2 * 3_600_000))).toBe('non-valido')
    expect(push).toHaveLength(0)
    expect(await avvisaNuovaInterrogazione(db, p, R, 'anna', new Date())).toBe(2)
    expect(push.map((x) => x.tokens[0]).sort()).toEqual(['token-bruno', 'token-carla']) // il docente no
    // già in lista: niente
    await db.doc(INTERR).update({ stato: 'lista' })
    expect(await avvisaNuovaInterrogazione(db, p, R, 'anna', new Date())).toBe('non-valido')
  })

  it('"domani": all\'ora di uscita chi non è stato interrogato slitta, e lo avvisa per la lezione dopo', async () => {
    // martedì e mercoledì; martedì 10/11 sera: Anna (n° 1) non è stata interrogata → tocca a lei mercoledì
    await conLista(['anna', 'bruno', 'carla'], { giorni: [1, 2] })
    const { p, push } = postinoFinto()
    expect(await ricordaDomani(db, p, new Date('2026-11-10T18:00:00Z'))).toBe(1)
    expect(push[0]).toMatchObject({ tokens: ['token-anna'], n: { testo: 'Storia – Orale (mercoledì 11/11): sei il n° 1.' } })
  })

  it('"domani": chi ha la data fissa domani è avvisato, e gli altri si spostano', async () => {
    // lunedì sera: domani martedì 10/11 è il giorno scelto da Carla; con 1 per lezione Anna passa a giovedì
    await conLista(['anna', 'bruno'], {}, {}, { carla: '2026-11-10' })
    const { p, push } = postinoFinto()
    expect(await ricordaDomani(db, p, LUNEDI_SERA)).toBe(1)
    expect(push[0]).toMatchObject({
      tokens: ['token-carla'],
      n: { titolo: 'Domani sei interrogato', testo: 'Storia – Orale (martedì 10/11): è la data che hai scelto.' },
    })
  })

  it('"domani": la data fissa non rispettata passa alla lezione dopo', async () => {
    // Carla aveva scelto martedì 10/11 ma non è stata interrogata: mercoledì sera, domani giovedì 12/11 tocca a lei
    await conLista(['anna', 'bruno'], {}, { anna: '2026-11-10' }, { carla: '2026-11-10' })
    const { p, push } = postinoFinto()
    expect(await ricordaDomani(db, p, new Date('2026-11-11T18:00:00Z'))).toBe(1)
    expect(push[0]!.tokens).toEqual(['token-carla'])
  })

  it('"domani": il giorno in cui è stata creata l\'interrogazione non conta', async () => {
    // creata e generata martedì 10/11 mattina: la prima lezione è mercoledì 11/11 (martedì e mercoledì)
    await conLista(['anna', 'bruno'], { giorni: [1, 2], creato: Timestamp.fromDate(new Date('2026-11-10T07:00:00Z')) })
    const { p, push } = postinoFinto()
    expect(await ricordaDomani(db, p, new Date('2026-11-10T18:00:00Z'))).toBe(1)
    expect(push[0]!.tokens).toEqual(['token-anna'])
  })

  it('"domani": salta chi è già stato interrogato e avvisa il successivo', async () => {
    // lunedì 09/11 sera: domani è martedì 10/11, lezione di Storia (giorni [1, 3] = martedì e giovedì)
    await conLista(['anna', 'bruno', 'carla'], {}, { anna: '2026-11-05' })
    const { p, push } = postinoFinto()
    expect(await ricordaDomani(db, p, LUNEDI_SERA)).toBe(1)
    expect(push[0]).toMatchObject({ tokens: ['token-bruno'], n: { testo: 'Storia – Orale (martedì 10/11): sei il n° 2.' } })
  })

  it('"domani": con 2 per lezione avvisa i primi due', async () => {
    await conLista(['anna', 'bruno', 'carla'], { perLezione: 2 })
    const { p, push } = postinoFinto()
    expect(await ricordaDomani(db, p, LUNEDI_SERA)).toBe(2)
    expect(push.map((x) => x.tokens[0])).toEqual(['token-anna', 'token-bruno'])
  })

  it('"domani": niente senza numero per lezione, o se domani è vacanza', async () => {
    await conLista(['anna', 'bruno', 'carla'], { perLezione: null })
    expect(await ricordaDomani(db, postinoFinto().p, LUNEDI_SERA)).toBe(0)
    await svuota()
    await conLista(['anna', 'bruno', 'carla'])
    await db.doc(`${CLASSE}/calendar/settings`).set({
      giorniScolastici: [true, true, true, true, true, false, false],
      fineAnno: '2027-06-06',
      eccezioni: [{ tipo: 'vacanza', da: '2026-11-10', a: '2026-11-10', descrizione: 'Chiusura' }],
    })
    expect(await ricordaDomani(db, postinoFinto().p, LUNEDI_SERA)).toBe(0)
  })

  it('"domani": solo dalle 18 alle 22 ora italiana, anche col cambio dell\'ora', async () => {
    await conLista(['anna', 'bruno', 'carla'])
    const { p } = postinoFinto()
    expect(await ricordaDomani(db, p, new Date('2026-11-09T16:59:00Z'))).toBe(0) // 17:59
    expect(await ricordaDomani(db, p, new Date('2026-11-09T21:00:00Z'))).toBe(0) // 22:00
    expect(await ricordaDomani(db, p, new Date('2026-11-09T17:00:00Z'))).toBe(1) // 18:00
  })
})

describe('/api/notifica', () => {
  const ORIGINE = 'https://whos-next.web.app'
  let precedente: string | undefined

  beforeAll(() => {
    precedente = process.env.FIREBASE_AUTH_EMULATOR_HOST
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099' // token dell'emulatore: non firmati
  })
  afterAll(() => {
    if (precedente === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = precedente
  })

  function b64(o: unknown) {
    return Buffer.from(JSON.stringify(o)).toString('base64url')
  }
  function tokenFinto(uid: string, aud = process.env.GCLOUD_PROJECT ?? 'demo-whosnext', email = `${uid}@studenti.ittsrimini.edu.it`) {
    const adesso = Math.floor(Date.now() / 1000)
    return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, aud, iat: adesso, auth_time: adesso, exp: adesso + 3600, email, name: `Nome ${uid}` })}.`
  }
  function richiesta(o: { metodo?: string; origine?: string | null; token?: string | null; corpo?: unknown; testo?: string }) {
    const h = new Headers({ 'Content-Type': 'application/json' })
    if (o.origine !== null) h.set('Origin', o.origine ?? ORIGINE)
    if (o.token) h.set('Authorization', `Bearer ${o.token}`)
    return new Request('https://server.test/api/notifica', {
      method: o.metodo ?? 'POST',
      headers: h,
      body: o.metodo === 'GET' || o.metodo === 'OPTIONS' ? undefined : (o.testo ?? JSON.stringify(o.corpo ?? {})),
    })
  }
  const CORPO = { tipo: 'lista-pronta', ...R }

  it('CORS: risponde solo al sito, mai a origini estranee', async () => {
    const ok = await notifica(richiesta({ metodo: 'OPTIONS' }))
    expect(ok.status).toBe(204)
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGINE)
    const estranea = await notifica(richiesta({ metodo: 'OPTIONS', origine: 'https://cattivo.example' }))
    expect(estranea.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('solo POST, solo con un token valido del nostro progetto', async () => {
    expect((await notifica(richiesta({ metodo: 'GET' }))).status).toBe(405)
    expect((await notifica(richiesta({ corpo: CORPO }))).status).toBe(401)
    expect((await notifica(richiesta({ corpo: CORPO, token: 'spazzatura' }))).status).toBe(401)
    expect((await notifica(richiesta({ corpo: CORPO, token: tokenFinto('anna', 'altro-progetto') }))).status).toBe(401)
    expect((await notifica(richiesta({ corpo: CORPO, token: tokenFinto('') }))).status).toBe(401)
  })

  it('rifiuta dati non validi e percorsi strani', async () => {
    await conLista(['anna', 'bruno', 'carla'])
    const t = tokenFinto('anna')
    expect((await notifica(richiesta({ token: t, testo: '{non è json' }))).status).toBe(400)
    expect((await notifica(richiesta({ token: t, corpo: { ...CORPO, classId: '../users' } }))).status).toBe(400)
    expect((await notifica(richiesta({ token: t, corpo: { ...CORPO, subjectId: 'a/b' } }))).status).toBe(400)
    expect((await notifica(richiesta({ token: t, corpo: { ...CORPO, interrogazioneId: 'x'.repeat(129) } }))).status).toBe(400)
    expect((await notifica(richiesta({ token: t, corpo: { ...CORPO, classId: 7 } }))).status).toBe(400)
    expect((await notifica(richiesta({ token: t, corpo: { ...CORPO, tipo: 'bomba' } }))).status).toBe(400)
    expect((await notifica(richiesta({ token: t, corpo: { ...CORPO, tipo: 'scambio-richiesta' } }))).status).toBe(400) // manca id
    // l'esito degli scambi non si notifica più
    expect((await notifica(richiesta({ token: t, corpo: { ...CORPO, tipo: 'scambio-esito', id: 'carla_0' } }))).status).toBe(400)
  })

  it('solo i membri della classe', async () => {
    await conLista(['anna', 'bruno', 'carla'])
    expect((await notifica(richiesta({ token: tokenFinto('estraneo'), corpo: CORPO }))).status).toBe(403)
  })

  it('un membro avvisa che la lista è pronta: una volta sola, anche se chiama due volte', async () => {
    await classe(TRE, { stato: 'lista' }, { token: false })
    await db.doc(`${INTERR}/list/current`).set({ ordine: ['anna', 'bruno', 'carla'], interrogati: {}, generataDa: 'anna' })
    const r1 = await notifica(richiesta({ token: tokenFinto('bruno'), corpo: CORPO }))
    expect(r1.status).toBe(200)
    expect(await r1.json()).toEqual({ esito: 3 })
    const r2 = await notifica(richiesta({ token: tokenFinto('bruno'), corpo: CORPO }))
    expect(await r2.json()).toEqual({ esito: 0 })
  })

  it('nuova interrogazione: chi l\'ha creata avvisa la classe, una volta sola; gli altri no', async () => {
    await classe(TRE, { scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() + 3_600_000)), creatoDa: 'anna' }, { token: false })
    const corpo = { ...CORPO, tipo: 'nuova-interrogazione' }
    expect(await (await notifica(richiesta({ token: tokenFinto('bruno'), corpo }))).json()).toEqual({ esito: 'non-valido' })
    expect(await (await notifica(richiesta({ token: tokenFinto('anna'), corpo }))).json()).toEqual({ esito: 2 })
    expect(await (await notifica(richiesta({ token: tokenFinto('anna'), corpo }))).json()).toEqual({ esito: 0 })
  })

  it('richiesta di scambio fatta passare per un altro: non parte', async () => {
    await classe(TRE, { stato: 'lista' }, { token: false })
    await db.doc(`${INTERR}/list/current`).set({ ordine: ['anna', 'bruno', 'carla'], interrogati: {}, generataDa: 'anna' })
    await db.doc(`${INTERR}/scambi/carla_0`).set({
      da: 'carla', daPos: 2, aPos: 0, stato: 'attesa', a: null, creato: Timestamp.now(), aggiornato: Timestamp.now(),
    })
    const r = await notifica(richiesta({ token: tokenFinto('bruno'), corpo: { ...CORPO, tipo: 'scambio-richiesta', id: 'carla_0' } }))
    expect(await r.json()).toEqual({ esito: 'non-valido' })
  })
})

describe('feedback', () => {
  const ORIGINE = 'https://whos-next.web.app'
  let precedente: string | undefined
  beforeAll(() => {
    precedente = process.env.FIREBASE_AUTH_EMULATOR_HOST
    process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
  })
  afterAll(() => {
    if (precedente === undefined) delete process.env.FIREBASE_AUTH_EMULATOR_HOST
    else process.env.FIREBASE_AUTH_EMULATOR_HOST = precedente
  })
  const chi = { uid: 'anna', email: 'anna.verdi@studenti.ittsrimini.edu.it', nome: 'Anna Verdi' }
  const adesso = new Date('2026-11-09T18:00:00Z')

  function postaFinta(o: { rotta?: boolean; spenta?: boolean } = {}) {
    const mandate: MessaggioFeedback[] = []
    return {
      mandate,
      invia: async (m: MessaggioFeedback) => {
        if (o.rotta) throw new Error('Gmail non risponde')
        if (o.spenta) return false
        mandate.push(m)
        return true
      },
    }
  }

  it('si salva e arriva per email con nome, email (per rispondere) e pagina', async () => {
    const { invia, mandate } = postaFinta()
    expect(await riceviFeedback(db, invia, chi, { testo: '  Bella app!\nMa il tema scuro…  ', pagina: '/impostazioni' }, adesso)).toBe('inviato')
    expect(mandate).toHaveLength(1)
    expect(mandate[0]!.oggetto).toBe('Feedback su WhosNext da Anna Verdi')
    expect(mandate[0]!.rispondiA).toBe(chi.email)
    expect(mandate[0]!.testo).toMatch(/^Bella app!\nMa il tema scuro…\n/)
    expect(mandate[0]!.testo).toContain('Da: Anna Verdi <anna.verdi@studenti.ittsrimini.edu.it>')
    expect(mandate[0]!.testo).toContain('Pagina: /impostazioni')
    const salvati = await db.collection('feedback').get()
    expect(salvati.size).toBe(1)
    expect(salvati.docs[0]!.data()).toMatchObject({ uid: 'anna', testo: 'Bella app!\nMa il tema scuro…', inviato: true })
  })

  it('se l\'email non parte (o non è configurata) resta salvato', async () => {
    expect(await riceviFeedback(db, postaFinta({ rotta: true }).invia, chi, { testo: 'Ciao ciao' }, adesso)).toBe('salvato')
    expect(await riceviFeedback(db, postaFinta({ spenta: true }).invia, chi, { testo: 'Ciao ciao' }, adesso)).toBe('salvato')
    const salvati = await db.collection('feedback').get()
    expect(salvati.docs.map((d) => d.data().inviato)).toEqual([false, false])
  })

  it('testi vuoti, troppo lunghi o strani: no; pagine strane si ignorano', async () => {
    const { invia, mandate } = postaFinta()
    for (const corpo of [null, {}, { testo: '' }, { testo: '  a ' }, { testo: 7 }, { testo: 'x'.repeat(2001) }, 'testo']) {
      expect(await riceviFeedback(db, invia, chi, corpo, adesso)).toBe('non-valido')
    }
    expect(await riceviFeedback(db, invia, chi, { testo: 'ok\u0000\u0007 va', pagina: 'https://cattivo.example' }, adesso)).toBe('inviato')
    expect(mandate[0]!.testo).toMatch(/^ok va\n/)
    expect(mandate[0]!.testo).not.toContain('Pagina:')
  })

  it('solo account della scuola', async () => {
    const { invia } = postaFinta()
    expect(await riceviFeedback(db, invia, { ...chi, email: 'qualcuno@gmail.com' }, { testo: 'Ciao ciao' }, adesso)).toBe('non-ammesso')
    expect(await riceviFeedback(db, invia, { ...chi, email: null }, { testo: 'Ciao ciao' }, adesso)).toBe('non-ammesso')
  })

  it('al massimo 5 al giorno a testa; il giorno dopo si riparte', async () => {
    const { invia } = postaFinta()
    for (let i = 0; i < 5; i++) expect(await riceviFeedback(db, invia, chi, { testo: `Numero ${i}` }, adesso)).toBe('inviato')
    expect(await riceviFeedback(db, invia, chi, { testo: 'Numero 6' }, adesso)).toBe('troppi')
    // un altro utente no
    expect(await riceviFeedback(db, invia, { ...chi, uid: 'bruno' }, { testo: 'Io sì' }, adesso)).toBe('inviato')
    // il giorno dopo (in Italia: 23:30 UTC è già domani)
    expect(await riceviFeedback(db, invia, chi, { testo: 'Di nuovo' }, new Date('2026-11-09T23:30:00Z'))).toBe('inviato')
    // anche chiamando tutti insieme, non più di 5
    const insieme = await Promise.all(
      Array.from({ length: 8 }, (_, i) => riceviFeedback(db, invia, { ...chi, uid: 'carla' }, { testo: `Insieme ${i}` }, adesso)),
    )
    expect(insieme.filter((e) => e === 'inviato')).toHaveLength(5)
    expect(insieme.filter((e) => e === 'troppi')).toHaveLength(3)
  })

  function richiesta(o: { metodo?: string; token?: string; corpo?: unknown; origine?: string }) {
    const h = new Headers({ 'Content-Type': 'application/json', Origin: o.origine ?? ORIGINE })
    if (o.token) h.set('Authorization', `Bearer ${o.token}`)
    return new Request('https://server.test/api/feedback', {
      method: o.metodo ?? 'POST',
      headers: h,
      body: o.metodo === 'OPTIONS' || o.metodo === 'GET' ? undefined : JSON.stringify(o.corpo ?? {}),
    })
  }
  function token(uid: string, email: string) {
    const b64 = (x: unknown) => Buffer.from(JSON.stringify(x)).toString('base64url')
    const t = Math.floor(Date.now() / 1000)
    return `${b64({ alg: 'none' })}.${b64({ sub: uid, aud: process.env.GCLOUD_PROJECT ?? 'demo-whosnext', iat: t, auth_time: t, exp: t + 3600, email })}.`
  }

  it('/api/feedback: CORS, metodo, token, dati, scuola, limite', async () => {
    const pre = await feedback(richiesta({ metodo: 'OPTIONS' }))
    expect(pre.status).toBe(204)
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe(ORIGINE)
    expect((await feedback(richiesta({ metodo: 'OPTIONS', origine: 'https://cattivo.example' }))).headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect((await feedback(richiesta({ metodo: 'GET' }))).status).toBe(405)
    expect((await feedback(richiesta({ corpo: { testo: 'Ciao ciao' } }))).status).toBe(401)
    expect((await feedback(richiesta({ token: 'spazzatura', corpo: { testo: 'Ciao ciao' } }))).status).toBe(401)
    const t = token('anna', 'anna.verdi@studenti.ittsrimini.edu.it')
    expect((await feedback(richiesta({ token: t, corpo: { testo: '' } }))).status).toBe(400)
    expect((await feedback(richiesta({ token: token('x', 'x@gmail.com'), corpo: { testo: 'Ciao ciao' } }))).status).toBe(403)
    // senza posta configurata (come nei test) si salva soltanto
    const ok = await feedback(richiesta({ token: t, corpo: { testo: 'Ciao ciao' } }))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ esito: 'salvato' })
    for (let i = 0; i < 4; i++) await feedback(richiesta({ token: t, corpo: { testo: 'Ancora uno' } }))
    expect((await feedback(richiesta({ token: t, corpo: { testo: 'Troppi' } }))).status).toBe(429)
  })
})
