import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { creaClasse, impostaDSA, impostaPermessoDocente, impostaVice, uniscitiConCodice } from '../../src/lib/classi'
import {
  creaInterrogazione,
  creaMateria,
  eliminaInterrogazione,
  rifInterrogazione,
  rifLista,
  rifPreferenza,
  rifPreferenze,
  rifRapporto,
} from '../../src/lib/configurazione'
import { eliminaClasse } from '../../src/lib/eliminaClasse'
import { generaEPubblicaLista, salvaPreferenza, togliPreferenza } from '../../src/lib/preferenze'
import { avviaAmbiente, dbDi, UTENTI } from './aiuti'

const { anna, bruno, carla, rossi, bianchi } = UTENTI

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

/** Anna capo, Bruno vice, Carla studente DSA, prof. Rossi con permesso; un'interrogazione aperta. */
async function interrogazioneAperta() {
  const { classId, codice } = await creaClasse(dbDi(env, anna), anna, '4ªB', () => 'AAAAAA')
  for (const p of [bruno, carla, rossi]) await uniscitiConCodice(dbDi(env, p), p, codice)
  await impostaVice(dbDi(env, anna), classId, 'bruno', true)
  await impostaDSA(dbDi(env, anna), classId, 'carla', true, 'anna')
  await impostaPermessoDocente(dbDi(env, anna), classId, 'rossi', true)
  const subjectId = await creaMateria(dbDi(env, anna), classId, { nome: 'Matematica', orario: [1, 3] })
  const interrogazioneId = await creaInterrogazione(dbDi(env, anna), classId, subjectId, {
    nome: 'Orale',
    descrizione: '',
    giorni: [1, 3],
    perLezione: 2,
    scadenzaPreferenze: new Date(Date.now() + 3_600_000),
  }, 'anna')
  return { classId, subjectId, interrogazioneId, codice }
}

/** Porta la scadenza nel passato (come se fosse passato il tempo). */
async function scadenzaPassata(r: { classId: string; subjectId: string; interrogazioneId: string }) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    await updateDoc(rifInterrogazione(db, r.classId, r.subjectId, r.interrogazioneId), {
      scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    })
  })
}

describe('preferenze', () => {
  it('gli studenti (capo e vice compresi) esprimono e cambiano la propria preferenza', async () => {
    const r = await interrogazioneAperta()
    await assertSucceeds(salvaPreferenza(dbDi(env, anna), r, 'anna', 'inizio'))
    await assertSucceeds(salvaPreferenza(dbDi(env, bruno), r, 'bruno', 'fine'))
    await assertSucceeds(salvaPreferenza(dbDi(env, bruno), r, 'bruno', 'indifferente'))
    const d = (await getDoc(rifPreferenza(dbDi(env, bruno), r.classId, r.subjectId, r.interrogazioneId, 'bruno'))).data()
    expect(d).toMatchObject({ scelta: 'indifferente', posizioneDSA: null })
    await assertSucceeds(togliPreferenza(dbDi(env, bruno), r, 'bruno'))
  })

  it('i docenti non esprimono preferenze', async () => {
    const r = await interrogazioneAperta()
    await assertFails(salvaPreferenza(dbDi(env, rossi), r, 'rossi', 'inizio'))
  })

  it('non si scrive la preferenza di un altro', async () => {
    const r = await interrogazioneAperta()
    await assertFails(salvaPreferenza(dbDi(env, bruno), r, 'anna', 'fine'))
    await assertFails(salvaPreferenza(dbDi(env, bianchi), r, 'bianchi', 'fine'))
  })

  it('la posizione esatta solo con il badge DSA/BES', async () => {
    const r = await interrogazioneAperta()
    await assertSucceeds(salvaPreferenza(dbDi(env, carla), r, 'carla', 'posizione', 1))
    await assertFails(salvaPreferenza(dbDi(env, bruno), r, 'bruno', 'posizione', 1))
    // valori non validi scritti direttamente
    const rif = rifPreferenza(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId, 'carla')
    await assertFails(setDoc(rif, { scelta: 'posizione', posizioneDSA: 0, aggiornato: serverTimestamp() }))
    await assertFails(setDoc(rif, { scelta: 'posizione', posizioneDSA: '1', aggiornato: serverTimestamp() }))
    await assertFails(setDoc(rif, { scelta: 'inizio', posizioneDSA: 3, aggiornato: serverTimestamp() }))
    await assertFails(setDoc(rif, { scelta: 'primo!', posizioneDSA: null, aggiornato: serverTimestamp() }))
  })

  it('ognuno vede solo la propria; capo e vice le vedono tutte; i docenti no', async () => {
    const r = await interrogazioneAperta()
    await salvaPreferenza(dbDi(env, carla), r, 'carla', 'posizione', 2)
    await assertSucceeds(getDoc(rifPreferenza(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId, 'carla')))
    await assertFails(getDoc(rifPreferenza(dbDi(env, rossi), r.classId, r.subjectId, r.interrogazioneId, 'carla')))
    await assertSucceeds(getDocs(rifPreferenze(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId)))
    await assertSucceeds(getDocs(rifPreferenze(dbDi(env, bruno), r.classId, r.subjectId, r.interrogazioneId)))
    await assertFails(getDocs(rifPreferenze(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId)))
    await assertFails(getDocs(rifPreferenze(dbDi(env, rossi), r.classId, r.subjectId, r.interrogazioneId)))
  })

  it('dopo la scadenza non si cambiano più', async () => {
    const r = await interrogazioneAperta()
    await salvaPreferenza(dbDi(env, bruno), r, 'bruno', 'fine')
    await scadenzaPassata(r)
    await assertFails(salvaPreferenza(dbDi(env, bruno), r, 'bruno', 'inizio'))
    await assertFails(togliPreferenza(dbDi(env, bruno), r, 'bruno'))
  })
})

describe('generazione della lista', () => {
  it('il capoclasse la genera dopo la scadenza; tutti la vedono, il rapporto solo capo e vice', async () => {
    const r = await interrogazioneAperta()
    await salvaPreferenza(dbDi(env, anna), r, 'anna', 'fine')
    await salvaPreferenza(dbDi(env, carla), r, 'carla', 'posizione', 1)
    await scadenzaPassata(r)
    const ris = await assertSucceeds(generaEPubblicaLista(dbDi(env, anna), r, 'anna', 7))
    expect(ris.ordine).toHaveLength(3) // anna, bruno, carla: il docente non c'è
    expect(ris.ordine[0]).toBe('carla')
    expect(ris.ordine[2]).toBe('anna')

    for (const p of [anna, bruno, carla, rossi]) {
      const l = await assertSucceeds(getDoc(rifLista(dbDi(env, p), r.classId, r.subjectId, r.interrogazioneId)))
      expect(l.data()?.ordine).toEqual(ris.ordine)
    }
    await assertSucceeds(getDoc(rifRapporto(dbDi(env, bruno), r.classId, r.subjectId, r.interrogazioneId)))
    await assertFails(getDoc(rifRapporto(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId)))
    await assertFails(getDoc(rifRapporto(dbDi(env, rossi), r.classId, r.subjectId, r.interrogazioneId)))
    await assertFails(getDoc(rifLista(dbDi(env, bianchi), r.classId, r.subjectId, r.interrogazioneId)))
    const stato = (await getDoc(rifInterrogazione(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId))).data()?.stato
    expect(stato).toBe('lista')
  })

  it('anche il vice la può generare', async () => {
    const r = await interrogazioneAperta()
    await scadenzaPassata(r)
    await assertSucceeds(generaEPubblicaLista(dbDi(env, bruno), r, 'bruno'))
  })

  it('prima della scadenza no, nemmeno scrivendo direttamente', async () => {
    const r = await interrogazioneAperta()
    await expect(generaEPubblicaLista(dbDi(env, anna), r, 'anna')).rejects.toMatchObject({ codice: 'dati-non-validi' })
    // aggirando il controllo del sito
    const db = dbDi(env, anna)
    const b = writeBatch(db)
    b.set(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), {
      ordine: ['anna'], interrogati: {}, generata: serverTimestamp(), generataDa: 'anna',
    })
    b.update(rifInterrogazione(db, r.classId, r.subjectId, r.interrogazioneId), { stato: 'lista', aggiornato: serverTimestamp() })
    await assertFails(b.commit())
  })

  it('studenti e docenti (anche con permesso) non la generano', async () => {
    const r = await interrogazioneAperta()
    await scadenzaPassata(r)
    await assertFails(generaEPubblicaLista(dbDi(env, carla), r, 'carla'))
    await assertFails(generaEPubblicaLista(dbDi(env, rossi), r, 'rossi'))
  })

  it('una volta generata non si rigenera né si modifica direttamente', async () => {
    const r = await interrogazioneAperta()
    await scadenzaPassata(r)
    await generaEPubblicaLista(dbDi(env, anna), r, 'anna')
    await expect(generaEPubblicaLista(dbDi(env, anna), r, 'anna')).rejects.toMatchObject({ codice: 'dati-non-validi' })
    const db = dbDi(env, anna)
    await assertFails(updateDoc(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), { ordine: ['carla', 'anna', 'bruno'] }))
    await assertFails(updateDoc(rifInterrogazione(db, r.classId, r.subjectId, r.interrogazioneId), { stato: 'raccolta', aggiornato: serverTimestamp() }))
  })

  it('non si scrive la lista senza cambiare lo stato', async () => {
    const r = await interrogazioneAperta()
    await scadenzaPassata(r)
    const db = dbDi(env, anna)
    await assertFails(
      setDoc(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), {
        ordine: ['anna'], interrogati: {}, generata: serverTimestamp(), generataDa: 'anna',
      }),
    )
    await assertFails(setDoc(doc(db, rifLista(db, r.classId, r.subjectId, r.interrogazioneId).parent.path, 'altro'), { x: 1 }))
  })
})

describe('eliminazione a cascata', () => {
  it('eliminando l\'interrogazione spariscono preferenze, lista e rapporto', async () => {
    const r = await interrogazioneAperta()
    await salvaPreferenza(dbDi(env, bruno), r, 'bruno', 'fine')
    await salvaPreferenza(dbDi(env, carla), r, 'carla', 'posizione', 1)
    await scadenzaPassata(r)
    await generaEPubblicaLista(dbDi(env, anna), r, 'anna')
    await assertSucceeds(eliminaInterrogazione(dbDi(env, bruno), r.classId, r.subjectId, r.interrogazioneId))
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore() as unknown as Firestore
      expect((await getDocs(rifPreferenze(db, r.classId, r.subjectId, r.interrogazioneId))).size).toBe(0)
      expect((await getDoc(rifLista(db, r.classId, r.subjectId, r.interrogazioneId))).exists()).toBe(false)
      expect((await getDoc(rifRapporto(db, r.classId, r.subjectId, r.interrogazioneId))).exists()).toBe(false)
    })
  })

  it('il capoclasse elimina una classe con preferenze e liste', async () => {
    const r = await interrogazioneAperta()
    await salvaPreferenza(dbDi(env, bruno), r, 'bruno', 'fine')
    await scadenzaPassata(r)
    await generaEPubblicaLista(dbDi(env, anna), r, 'anna')
    await assertSucceeds(eliminaClasse(dbDi(env, anna), r.classId, r.codice))
  })

  it('le preferenze degli altri non si cancellano finché l\'interrogazione esiste', async () => {
    const r = await interrogazioneAperta()
    await salvaPreferenza(dbDi(env, bruno), r, 'bruno', 'fine')
    await assertFails(togliPreferenza(dbDi(env, anna), r, 'bruno'))
  })
})
