import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, collectionGroup, deleteDoc, getDocs, writeBatch, type Firestore } from 'firebase/firestore'
import {
  creaClasse,
  impostaDSA,
  impostaVice,
  queryMieIscrizioni,
  rifClasse,
  rifInvito,
  rifMembro,
  uniscitiConCodice,
} from '../../src/lib/classi'
import { creaInterrogazione, creaMateria, rifCalendario, salvaCalendario } from '../../src/lib/configurazione'
import { eliminaClasse } from '../../src/lib/eliminaClasse'
import { CALENDARIO_DEFAULT } from '../../src/lib/calendar'
import type { Profilo } from '../../src/lib/tipi'
import { avviaAmbiente, dbDi, UTENTI } from './aiuti'

const { anna, bruno, carla, rossi } = UTENTI

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

/** Classe completa: membri, vice, DSA, calendario, una materia con un'interrogazione. */
async function classePiena(altriStudenti: Profilo[] = []) {
  const { classId, codice } = await creaClasse(dbDi(env, anna), anna, '4ªB', () => 'AAAAAA')
  for (const p of [bruno, carla, rossi, ...altriStudenti]) await uniscitiConCodice(dbDi(env, p), p, codice)
  await impostaVice(dbDi(env, anna), classId, 'bruno', true)
  await impostaDSA(dbDi(env, anna), classId, 'carla', true, 'anna')
  await salvaCalendario(dbDi(env, anna), classId, CALENDARIO_DEFAULT)
  const s = await creaMateria(dbDi(env, anna), classId, { nome: 'Matematica', orario: [1] })
  await creaInterrogazione(dbDi(env, anna), classId, s, {
    nome: 'Orale',
    descrizione: '',
    giorni: [1],
    perLezione: 2,
    scadenzaPreferenze: new Date(Date.now() + 86_400_000),
  }, 'anna')
  return { classId, codice }
}

/** Quanti documenti restano nel database (lettura senza regole). */
async function documentiRimasti(): Promise<number> {
  let n = 0
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore
    for (const nome of ['members', 'dsa', 'calendar', 'subjects', 'interrogations']) {
      n += (await getDocs(collectionGroup(db, nome))).size
    }
    for (const nome of ['classes', 'invites']) n += (await getDocs(collection(db, nome))).size
  })
  return n
}

describe('eliminare una classe', () => {
  it('il capoclasse la elimina con tutto quello che contiene', async () => {
    const { classId, codice } = await classePiena()
    // classe, codice, 4 membri, 1 DSA, calendario, materia, interrogazione
    expect(await documentiRimasti()).toBe(10)
    await assertSucceeds(eliminaClasse(dbDi(env, anna), classId, codice))
    expect(await documentiRimasti()).toBe(0)
    // nessuno la vede più tra le proprie classi
    expect((await getDocs(queryMieIscrizioni(dbDi(env, bruno), 'bruno'))).size).toBe(0)
  })

  it('funziona anche con una classe di 30 studenti', async () => {
    const altri: Profilo[] = Array.from({ length: 26 }, (_, i) => ({
      uid: `s${i}`,
      nome: `Studente ${i}`,
      email: `s${i}@studenti.ittsrimini.edu.it`,
      foto: null,
      tipo: 'studente',
    }))
    const { classId, codice } = await classePiena(altri)
    await assertSucceeds(eliminaClasse(dbDi(env, anna), classId, codice))
    expect(await documentiRimasti()).toBe(0)
  })

  it('funziona anche con una classe vuota (niente calendario salvato, niente materie)', async () => {
    const { classId, codice } = await creaClasse(dbDi(env, anna), anna, 'Vuota', () => 'VVVVVV')
    await assertSucceeds(eliminaClasse(dbDi(env, anna), classId, codice))
    expect(await documentiRimasti()).toBe(0)
  })

  it('vice, studenti e docenti non la eliminano', async () => {
    const { classId, codice } = await classePiena()
    await assertFails(eliminaClasse(dbDi(env, bruno), classId, codice))
    await assertFails(eliminaClasse(dbDi(env, carla), classId, codice))
    await assertFails(eliminaClasse(dbDi(env, rossi), classId, codice))
  })

  it('non si elimina la classe lasciando in giro il codice d\'invito', async () => {
    const { classId } = await classePiena()
    const db = dbDi(env, anna)
    const b = writeBatch(db)
    b.delete(rifMembro(db, classId, 'anna'))
    b.delete(rifClasse(db, classId))
    await assertFails(b.commit())
  })

  it('il capoclasse non cancella il proprio documento né il codice senza eliminare la classe', async () => {
    const { classId, codice } = await classePiena()
    const db = dbDi(env, anna)
    await assertFails(deleteDoc(rifMembro(db, classId, 'anna')))
    await assertFails(deleteDoc(rifInvito(db, codice)))
    await assertFails(deleteDoc(rifCalendario(db, classId)))
  })

  it('dopo l\'eliminazione il codice non funziona più', async () => {
    const { classId, codice } = await classePiena()
    await eliminaClasse(dbDi(env, anna), classId, codice)
    const nuovo = { uid: 'z', nome: 'Z', email: 'z@studenti.ittsrimini.edu.it', foto: null, tipo: 'studente' } satisfies Profilo
    await expect(uniscitiConCodice(dbDi(env, nuovo), nuovo, codice)).rejects.toMatchObject({ codice: 'codice-inesistente' })
  })
})
