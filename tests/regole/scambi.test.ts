import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { creaClasse, rifMembro, uniscitiConCodice } from '../../src/lib/classi'
import {
  creaInterrogazione,
  creaMateria,
  eliminaInterrogazione,
  rifInterrogazione,
  rifLista,
  rifScambi,
  rifScambio,
  rifStorico,
} from '../../src/lib/configurazione'
import { riordinaLista, segnaInterrogati } from '../../src/lib/gestioneLista'
import { generaEPubblicaLista } from '../../src/lib/preferenze'
import {
  accettaScambio,
  annullaScambio,
  chiediScambio,
  impostaRifiutaScambi,
  rifiutaScambio,
  type Scambio,
} from '../../src/lib/scambi'
import { aggiungiVoceStorico } from '../../src/lib/storico'
import type { DocLista, DocScambio } from '../../src/lib/tipi'
import { avviaAmbiente, dbDi, UTENTI } from './aiuti'

const { anna, bruno, carla, rossi } = UTENTI
const dario = { uid: 'dario', nome: 'Dario', email: 'dario.gialli@studenti.ittsrimini.edu.it', foto: null, tipo: 'studente' as const }
const ORDINE = ['anna', 'bruno', 'carla', 'dario']

let env: RulesTestEnvironment
beforeAll(async () => {
  env = await avviaAmbiente()
})
afterAll(async () => {
  await env.cleanup()
})
beforeEach(async () => {
  await env.clearFirestore()
})

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

/** Lista pronta con ordine anna, bruno, carla, dario (Anna capo, Rossi docente). */
async function listaPronta(): Promise<Rif> {
  const { classId, codice } = await creaClasse(dbDi(env, anna), anna, '4ªB', () => 'AAAAAA')
  for (const p of [bruno, carla, dario, rossi]) await uniscitiConCodice(dbDi(env, p), p, codice)
  const subjectId = await creaMateria(dbDi(env, anna), classId, { nome: 'Storia', orario: [1] })
  const interrogazioneId = await creaInterrogazione(
    dbDi(env, anna),
    classId,
    subjectId,
    { nome: 'Orale', descrizione: '', giorni: [1], perLezione: 1, scadenzaPreferenze: new Date(Date.now() + 3_600_000) },
    'anna',
  )
  const r = { classId, subjectId, interrogazioneId }
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(rifInterrogazione(ctx.firestore() as unknown as Firestore, classId, subjectId, interrogazioneId), {
      scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    })
  })
  await generaEPubblicaLista(dbDi(env, anna), r, 'anna', 1)
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(rifLista(ctx.firestore() as unknown as Firestore, classId, subjectId, interrogazioneId), { ordine: ORDINE })
  })
  return r
}

async function lista(r: Rif): Promise<DocLista> {
  return (await getDoc(rifLista(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId))).data() as DocLista
}

async function mie(r: Rif, p: { uid: string; email: string }): Promise<Scambio[]> {
  const snap = await getDocs(query(rifScambi(dbDi(env, p), r.classId, r.subjectId, r.interrogazioneId), where('da', '==', p.uid)))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocScambio) }))
}

/** Le richieste in attesa per la posizione di p (come fa il sito). */
function inArrivo(r: Rif, p: { uid: string; email: string }, pos: number) {
  return getDocs(
    query(rifScambi(dbDi(env, p), r.classId, r.subjectId, r.interrogazioneId), where('stato', '==', 'attesa'), where('aPos', '==', pos)),
  )
}

async function chiedi(r: Rif, p: { uid: string; email: string }, aPos: number): Promise<Scambio> {
  const id = await chiediScambio(dbDi(env, p), r, p.uid, await lista(r), aPos, await mie(r, p))
  const d = await getDoc(rifScambio(dbDi(env, p), r.classId, r.subjectId, r.interrogazioneId, id))
  return { id, ...(d.data() as DocScambio) }
}

async function accetta(r: Rif, p: { uid: string; email: string }, s: Scambio) {
  return accettaScambio(dbDi(env, p), r, s, p.uid, await lista(r))
}

/** Come accettaScambio ma senza i controlli del sito: risponde solo il database. */
async function accettaSenzaControlli(r: Rif, p: { uid: string; email: string }, s: Scambio, come = p.uid) {
  const db = dbDi(env, p)
  const l = await lista(r)
  const ordine = [...l.ordine]
  ;[ordine[s.daPos], ordine[s.aPos]] = [ordine[s.aPos]!, ordine[s.daPos]!]
  const b = writeBatch(db)
  const voce = aggiungiVoceStorico(db, b, r, p.uid, 'scambio', {})
  b.update(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), {
    ordine, scambio: s.id, ultimaModifica: voce, aggiornato: serverTimestamp(), aggiornatoDa: p.uid,
  })
  b.update(rifScambio(db, r.classId, r.subjectId, r.interrogazioneId, s.id), { stato: 'accettato', a: come, aggiornato: serverTimestamp() })
  return b.commit()
}

describe('chiedere e accettare uno scambio', () => {
  it('si scambiano solo le due posizioni, con la voce nello storico', async () => {
    const r = await listaPronta()
    const s = await chiedi(r, bruno, 3) // Bruno (n° 2) chiede la posizione di Dario (n° 4)
    expect(s).toMatchObject({ da: 'bruno', daPos: 1, aPos: 3, stato: 'attesa', a: null })

    // Dario vede la richiesta, Carla no, il capo sì
    expect((await inArrivo(r, dario, 3)).size).toBe(1)
    await assertFails(inArrivo(r, carla, 3))
    await assertFails(getDoc(rifScambio(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId, s.id)))
    await assertSucceeds(getDoc(rifScambio(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId, s.id)))

    await assertSucceeds(accetta(r, dario, s))
    expect((await lista(r)).ordine).toEqual(['anna', 'dario', 'carla', 'bruno'])
    const voci = await getDocs(query(rifStorico(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId), orderBy('quando')))
    expect(voci.docs.at(-1)!.data()).toMatchObject({ tipo: 'scambio', chi: 'dario', dettagli: { uids: ['bruno', 'dario'], posizioni: [2, 4] } })
    // a scambio fatto, Bruno vede com'è andata
    expect((await mie(r, bruno))[0]).toMatchObject({ stato: 'accettato', a: 'dario' })
  })

  it('accetta solo chi occupa la posizione richiesta', async () => {
    const r = await listaPronta()
    const s = await chiedi(r, bruno, 3)
    await assertFails(accettaSenzaControlli(r, carla, s))
    await assertFails(accettaSenzaControlli(r, bruno, s, 'dario'))
    // nemmeno il capo al posto di Dario (il capo può riordinare, ma non "accettare" per gli altri)
    await assertFails(accettaSenzaControlli(r, anna, s, 'dario'))
  })

  it('niente modifiche nascoste insieme allo scambio', async () => {
    const r = await listaPronta()
    const s = await chiedi(r, bruno, 3)
    const db = dbDi(env, dario)
    const rifL = rifLista(db, r.classId, r.subjectId, r.interrogazioneId)
    const rifS = rifScambio(db, r.classId, r.subjectId, r.interrogazioneId, s.id)
    const prova = (ordine: string[], conRichiesta = true, extra: Record<string, unknown> = {}) => {
      const b = writeBatch(db)
      const voce = aggiungiVoceStorico(db, b, r, 'dario', 'scambio', {})
      b.update(rifL, { ordine, scambio: s.id, ultimaModifica: voce, aggiornato: serverTimestamp(), aggiornatoDa: 'dario', ...extra })
      if (conRichiesta) b.update(rifS, { stato: 'accettato', a: 'dario', aggiornato: serverTimestamp() })
      return b.commit()
    }
    await assertFails(prova(['carla', 'dario', 'anna', 'bruno'])) // anche Anna e Carla scambiate
    await assertFails(prova(['anna', 'carla', 'dario', 'bruno'])) // Dario in un altro posto
    await assertFails(prova(['anna', 'dario', 'carla', 'bruno'], false)) // senza accettare la richiesta
    await assertFails(prova(['anna', 'dario', 'carla', 'bruno'], true, { interrogati: { anna: '2026-11-03' } }))
    // la richiesta accettata senza cambiare la lista
    await assertFails(updateDoc(rifS, { stato: 'accettato', a: 'dario', aggiornato: serverTimestamp() }))
    // e infine quella giusta
    await assertSucceeds(prova(['anna', 'dario', 'carla', 'bruno']))
  })
})

describe('regole delle richieste', () => {
  it('al massimo 3 richieste aperte; quelle chiuse liberano il posto', async () => {
    const r = await listaPronta()
    const db = dbDi(env, bruno)
    const nuova = (id: string, aPos: number) =>
      setDoc(rifScambio(db, r.classId, r.subjectId, r.interrogazioneId, id), {
        da: 'bruno',
        daPos: 1,
        aPos,
        stato: 'attesa',
        creato: serverTimestamp(),
        aggiornato: serverTimestamp(),
        a: null,
      })
    await assertSucceeds(nuova('bruno_0', 0))
    await assertSucceeds(nuova('bruno_1', 2))
    await assertSucceeds(nuova('bruno_2', 3))
    await assertFails(nuova('bruno_3', 0)) // un quarto posto non c'è
    await assertFails(nuova('bruno_0', 2)) // il posto 0 è occupato da una richiesta in attesa
    await expect(chiediScambio(db, r, 'bruno', await lista(r), 0, await mie(r, bruno))).rejects.toThrow(/3 richieste/)
    await annullaScambio(db, r, 'bruno_0')
    await assertSucceeds(nuova('bruno_0', 2))
    // non a nome di altri, né dalla posizione sbagliata
    await assertFails(setDoc(rifScambio(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId, 'bruno_1'), {}))
    await annullaScambio(db, r, 'bruno_1')
    await assertFails(
      setDoc(rifScambio(db, r.classId, r.subjectId, r.interrogazioneId, 'bruno_1'), {
        da: 'bruno', daPos: 2, aPos: 0, stato: 'attesa', creato: serverTimestamp(), aggiornato: serverTimestamp(), a: null,
      }),
    )
  })

  it('la richiesta segue la posizione', async () => {
    const r = await listaPronta()
    const diCarla = await chiedi(r, carla, 1) // Carla (n° 3) vuole la posizione n° 2, ora di Bruno
    const diDario = await chiedi(r, dario, 1) // anche Dario la vuole
    await accetta(r, bruno, diDario) // Bruno accetta Dario: ora Dario è n° 2, Bruno n° 4
    expect((await lista(r)).ordine).toEqual(['anna', 'dario', 'carla', 'bruno'])
    // la richiesta di Carla ora è per Dario: lui la vede e può accettarla, Bruno non più
    expect((await inArrivo(r, dario, 1)).docs.map((d) => d.id)).toEqual([diCarla.id])
    await assertFails(getDoc(rifScambio(dbDi(env, bruno), r.classId, r.subjectId, r.interrogazioneId, diCarla.id)))
    await assertSucceeds(accetta(r, dario, diCarla))
    expect((await lista(r)).ordine).toEqual(['anna', 'carla', 'dario', 'bruno'])
  })

  it('chi nel frattempo ha cambiato posto non può più farsi accettare la vecchia richiesta', async () => {
    const r = await listaPronta()
    const s = await chiedi(r, bruno, 2)
    await riordinaLista(dbDi(env, anna), r, ['bruno', 'anna', 'carla', 'dario'], 'anna')
    await assertFails(accettaSenzaControlli(r, carla, s))
    await expect(accetta(r, carla, s)).rejects.toThrow(/non è più possibile/) // il sito lo dice prima
  })

  it('niente scambi con chi è già stato interrogato', async () => {
    const r = await listaPronta()
    const s = await chiedi(r, bruno, 3)
    await segnaInterrogati(dbDi(env, anna), r, ['dario'], '2026-11-03', 'anna')
    await assertFails(chiedi(r, carla, 3))
    await assertFails(accettaSenzaControlli(r, dario, s)) // anche saltando il controllo del sito
  })

  it('"Rifiuta in automatico": nessuna richiesta nuova, e quelle arrivate vengono rifiutate', async () => {
    const r = await listaPronta()
    const s = await chiedi(r, bruno, 2)
    await assertSucceeds(impostaRifiutaScambi(dbDi(env, carla), r.classId, 'carla', true, [{ r, id: s.id }]))
    expect((await mie(r, bruno))[0]).toMatchObject({ stato: 'rifiutato', a: 'carla' })
    await assertFails(chiedi(r, dario, 2))
    // l'impostazione è solo propria
    await assertFails(updateDoc(rifMembro(dbDi(env, bruno), r.classId, 'dario'), { rifiutaScambi: true }))
    await assertSucceeds(impostaRifiutaScambi(dbDi(env, carla), r.classId, 'carla', false))
    await assertSucceeds(chiedi(r, dario, 2))
  })

  it('rifiutare e annullare; i docenti non chiedono scambi', async () => {
    const r = await listaPronta()
    const s = await chiedi(r, bruno, 3)
    await assertFails(rifiutaScambio(dbDi(env, carla), r, s.id, 'carla'))
    await assertFails(annullaScambio(dbDi(env, carla), r, s.id))
    await assertSucceeds(rifiutaScambio(dbDi(env, dario), r, s.id, 'dario'))
    await assertFails(accettaSenzaControlli(r, dario, s)) // già rifiutata
    const s2 = await chiedi(r, bruno, 2)
    await assertSucceeds(annullaScambio(dbDi(env, bruno), r, s2.id))
    await assertFails(
      setDoc(rifScambio(dbDi(env, rossi), r.classId, r.subjectId, r.interrogazioneId, 'rossi_0'), {
        da: 'rossi', daPos: 0, aPos: 1, stato: 'attesa', creato: serverTimestamp(), aggiornato: serverTimestamp(), a: null,
      }),
    )
  })

  it('eliminando l\'interrogazione spariscono anche le richieste', async () => {
    const r = await listaPronta()
    await chiedi(r, bruno, 3)
    await assertSucceeds(eliminaInterrogazione(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId))
  })
})
