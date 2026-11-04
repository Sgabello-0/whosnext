/**
 * Casi difficili per il server: esecuzioni in contemporanea, dati strani, confini di orario,
 * e l'indirizzo /api/notifica (controlli su origine, token, dati e iscrizione alla classe).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Timestamp } from 'firebase-admin/firestore'
import { database } from '../../netlify/lib/admin'
import { avvisaEsitoScambio, avvisaListaPronta, ricordaDomani, ricordaScelte } from '../../netlify/lib/eventi'
import { generaScadute } from '../../netlify/lib/generazione'
import { avvisa, type Postino } from '../../netlify/lib/postino'
import type { Notifica } from '../../netlify/lib/testi'
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

async function conLista(ordine: string[], extra: Record<string, unknown> = {}, interrogati: Record<string, string> = {}) {
  await classe(TRE, { stato: 'lista', ...extra })
  await db.doc(`${INTERR}/list/current`).set({ ordine, interrogati, generataDa: 'anna' })
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

  it('la posizione esatta DSA vale anche quando genera il server; chi è uscito non c\'è', async () => {
    await classe(TRE)
    await db.doc(`${CLASSE}/dsa/carla`).set({ da: 'anna' })
    await db.doc(`${INTERR}/preferences/carla`).set({ scelta: 'posizione', posizioneDSA: 1, aggiornato: Timestamp.now() })
    await db.doc(`${INTERR}/preferences/uscito`).set({ scelta: 'inizio', posizioneDSA: null, aggiornato: Timestamp.now() })
    await generaScadute(db, new Date())
    const ordine = (await db.doc(`${INTERR}/list/current`).get()).data()!.ordine
    expect(ordine[0]).toBe('carla')
    expect(ordine).not.toContain('uscito')
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

  it('esito accettato: a chi l\'aveva chiesto, con la posizione nuova', async () => {
    await conLista(['anna', 'bruno', 'carla'])
    // Carla (n° 3) ha chiesto il n° 1 ad Anna, che ha accettato: la lista è già scambiata
    await db.doc(`${INTERR}/list/current`).update({ ordine: ['carla', 'bruno', 'anna'] })
    await db.doc(`${INTERR}/scambi/carla_0`).set({
      da: 'carla', daPos: 2, aPos: 0, stato: 'accettato', a: 'anna', creato: Timestamp.now(), aggiornato: Timestamp.now(),
    })
    const { p, push } = postinoFinto()
    expect(await avvisaEsitoScambio(db, p, R, 'carla_0', 'anna')).toBe('mandata')
    expect(push[0]).toMatchObject({
      tokens: ['token-carla'],
      n: { titolo: 'Scambio accettato da Anna', testo: 'Storia – Orale: ora sei il n° 1.' },
    })
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

  it('promemoria: anche a chi ha tolto la preferenza; mai dopo la scadenza o a liste fatte', async () => {
    const tra2ore = Timestamp.fromDate(new Date(Date.now() + 2 * 3_600_000))
    await classe(TRE, { scadenzaPreferenze: tra2ore })
    await db.doc(`${INTERR}/preferences/anna`).set({ scelta: 'fine', posizioneDSA: null, aggiornato: Timestamp.now() })
    await db.doc(`${INTERR}/preferences/bruno`).set({ scelta: 'inizio', posizioneDSA: null, aggiornato: Timestamp.now() })
    await db.doc(`${INTERR}/preferences/bruno`).delete() // ci ha ripensato
    const { p, push } = postinoFinto()
    expect(await ricordaScelte(db, p, new Date())).toBe(2)
    expect(push.map((x) => x.tokens[0]).sort()).toEqual(['token-bruno', 'token-carla'])
    // scaduta da poco: niente promemoria
    await svuota()
    await classe(TRE, { scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() - 1000)) })
    expect(await ricordaScelte(db, p, new Date())).toBe(0)
  })

  it('promemoria: la scadenza cambiata riapre il promemoria (una volta per scadenza)', async () => {
    const tra2ore = new Date(Date.now() + 2 * 3_600_000)
    await classe(TRE, { scadenzaPreferenze: Timestamp.fromDate(tra2ore) })
    const { p } = postinoFinto()
    expect(await ricordaScelte(db, p, new Date())).toBe(3)
    expect(await ricordaScelte(db, p, new Date())).toBe(0)
    await db.doc(INTERR).update({ scadenzaPreferenze: Timestamp.fromDate(new Date(tra2ore.getTime() + 3_600_000)) })
    expect(await ricordaScelte(db, p, new Date())).toBe(3)
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
  function tokenFinto(uid: string, aud = process.env.GCLOUD_PROJECT ?? 'demo-whosnext') {
    const adesso = Math.floor(Date.now() / 1000)
    return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: uid, aud, iat: adesso, auth_time: adesso, exp: adesso + 3600 })}.`
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
