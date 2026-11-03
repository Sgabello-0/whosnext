import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, deleteDoc, getDoc, getDocs, orderBy, query, serverTimestamp, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import {
  cediRuolo,
  creaClasse,
  impostaPermessoDocente,
  impostaVice,
  rifClasse,
  rifMembro,
  uniscitiConCodice,
} from '../../src/lib/classi'
import { creaInterrogazione, creaMateria, rifInterrogazione, rifLista, rifStorico } from '../../src/lib/configurazione'
import { riordinaLista, segnaInterrogati, togliInterrogato } from '../../src/lib/gestioneLista'
import { generaEPubblicaLista } from '../../src/lib/preferenze'
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

/** Anna capo, Bruno vice, Carla studente, Rossi docente, Bianchi docente con permesso. */
async function classe() {
  const { classId, codice } = await creaClasse(dbDi(env, anna), anna, '4ªB', () => 'AAAAAA')
  for (const p of [bruno, carla, rossi, bianchi]) await uniscitiConCodice(dbDi(env, p), p, codice)
  await impostaVice(dbDi(env, anna), classId, 'bruno', true)
  await impostaPermessoDocente(dbDi(env, anna), classId, 'bianchi', true)
  return { classId, codice }
}

async function ruolo(classId: string, uid: string) {
  return (await getDoc(rifMembro(dbDi(env, anna), classId, uid))).data()?.ruolo
}

describe('cedere il ruolo di capoclasse', () => {
  it('il capo cede il ruolo a uno studente e resta vice', async () => {
    const { classId } = await classe()
    await assertSucceeds(cediRuolo(dbDi(env, anna), classId, 'anna', 'carla', true))
    expect((await getDoc(rifClasse(dbDi(env, carla), classId))).data()?.capoclasseUid).toBe('carla')
    expect(await ruolo(classId, 'carla')).toBe('capo')
    expect(await ruolo(classId, 'anna')).toBe('vice')
    // il nuovo capo ha i poteri del capo, il vecchio no
    await assertSucceeds(impostaVice(dbDi(env, carla), classId, 'bruno', false))
    await assertFails(impostaVice(dbDi(env, anna), classId, 'bruno', true))
  })

  it('al vice, tornando studente', async () => {
    const { classId } = await classe()
    await assertSucceeds(cediRuolo(dbDi(env, anna), classId, 'anna', 'bruno', false))
    expect(await ruolo(classId, 'bruno')).toBe('capo')
    expect(await ruolo(classId, 'anna')).toBe('studente')
  })

  it('mai a un docente, né da chi non è capo', async () => {
    const { classId } = await classe()
    await assertFails(cediRuolo(dbDi(env, anna), classId, 'anna', 'rossi', true))
    await assertFails(cediRuolo(dbDi(env, bruno), classId, 'bruno', 'carla', true))
    await assertFails(cediRuolo(dbDi(env, carla), classId, 'anna', 'carla', true))
  })

  it('mai due capi: non si nomina un capo senza cedere, né si cede senza nominarne un altro', async () => {
    const { classId } = await classe()
    const db = dbDi(env, anna)
    await assertFails(updateDoc(rifMembro(db, classId, 'carla'), { ruolo: 'capo' }))
    await assertFails(updateDoc(rifClasse(db, classId), { capoclasseUid: 'carla' }))
    await assertFails(updateDoc(rifMembro(db, classId, 'anna'), { ruolo: 'vice' }))
    // classe e nuovo capo, ma il vecchio resta capo
    const b = writeBatch(db)
    b.update(rifClasse(db, classId), { capoclasseUid: 'carla' })
    b.update(rifMembro(db, classId, 'carla'), { ruolo: 'capo' })
    await assertFails(b.commit())
  })
})

// ───────────────────────────────────────────────────────────

async function listaPronta() {
  const { classId } = await classe()
  const subjectId = await creaMateria(dbDi(env, anna), classId, { nome: 'Storia', orario: [1] })
  const interrogazioneId = await creaInterrogazione(dbDi(env, anna), classId, subjectId, {
    nome: 'Orale',
    descrizione: '',
    giorni: [1],
    perLezione: 1,
    scadenzaPreferenze: new Date(Date.now() + 3_600_000),
  }, 'anna')
  const r = { classId, subjectId, interrogazioneId }
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(rifInterrogazione(ctx.firestore() as unknown as Firestore, classId, subjectId, interrogazioneId), {
      scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    })
  })
  const { ordine } = await generaEPubblicaLista(dbDi(env, anna), r, 'anna', 5)
  return { r, ordine }
}

async function storico(r: { classId: string; subjectId: string; interrogazioneId: string }, chi = carla) {
  const snap = await getDocs(query(rifStorico(dbDi(env, chi), r.classId, r.subjectId, r.interrogazioneId), orderBy('quando')))
  return snap.docs.map((d) => d.data())
}

describe('storico delle modifiche', () => {
  it('ogni modifica lascia una voce, che tutti i membri vedono', async () => {
    const { r, ordine } = await listaPronta()
    await riordinaLista(dbDi(env, bianchi), r, [ordine[2]!, ordine[0]!, ordine[1]!], 'bianchi')
    await segnaInterrogati(dbDi(env, bruno), r, [ordine[2]!], '2026-11-03', 'bruno')
    await togliInterrogato(dbDi(env, anna), r, ordine[2]!, 'anna')
    const voci = await storico(r)
    expect(voci.map((v) => [v.tipo, v.chi])).toEqual([
      ['generata', 'anna'],
      ['riordino', 'bianchi'],
      ['interrogati', 'bruno'],
      ['annullato', 'anna'],
    ])
    expect(voci[0]!.dettagli).toEqual({ seme: 5 })
    // spostato solo chi è stato trascinato (l'ultimo portato in cima)
    expect(voci[1]!.dettagli.spostati).toEqual([{ uid: ordine[2], da: 3, a: 1 }])
    expect(voci[2]!.dettagli).toEqual({ uids: [ordine[2]], data: '2026-11-03' })
    await assertSucceeds(getDocs(rifStorico(dbDi(env, rossi), r.classId, r.subjectId, r.interrogazioneId)))
  })

  it('la lista non si modifica senza una voce nuova nello storico', async () => {
    const { r, ordine } = await listaPronta()
    const db = dbDi(env, anna)
    const rif = rifLista(db, r.classId, r.subjectId, r.interrogazioneId)
    const vecchia = (await getDoc(rif)).data()!.ultimaModifica
    const base = { ordine: [...ordine].reverse(), aggiornato: serverTimestamp(), aggiornatoDa: 'anna' }
    await assertFails(updateDoc(rif, base))
    await assertFails(updateDoc(rif, { ...base, ultimaModifica: vecchia })) // voce già esistente
    await assertFails(updateDoc(rif, { ...base, ultimaModifica: 'inventata' })) // voce che non esiste
  })

  it('lo storico non si modifica, non si cancella e non si scrive a nome di altri', async () => {
    const { r } = await listaPronta()
    const [prima] = (await getDocs(rifStorico(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId))).docs
    await assertFails(updateDoc(prima!.ref, { chi: 'bruno' }))
    await assertFails(deleteDoc(prima!.ref))
    await assertFails(
      addDoc(rifStorico(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId), {
        tipo: 'riordino',
        chi: 'anna',
        quando: serverTimestamp(),
        dettagli: {},
      }),
    ) // senza la modifica della lista che la indica
  })

  it('chi non può modificare la lista non scrive nello storico; chi non è della classe non lo legge', async () => {
    const { r } = await listaPronta()
    await assertFails(
      addDoc(rifStorico(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId), {
        tipo: 'riordino',
        chi: 'carla',
        quando: serverTimestamp(),
        dettagli: {},
      }),
    )
    const esterno = { uid: 'x', email: 'x@studenti.ittsrimini.edu.it' }
    await assertFails(getDocs(rifStorico(dbDi(env, esterno), r.classId, r.subjectId, r.interrogazioneId)))
  })
})
