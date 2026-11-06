import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { addDoc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore'
import { creaClasse, impostaPermessoDocente, impostaVice, uniscitiConCodice } from '../../src/lib/classi'
import {
  aggiornaInterrogazione,
  aggiornaMateria,
  aggiornaOrari,
  creaInterrogazione,
  creaMateria,
  eliminaInterrogazione,
  eliminaMateria,
  rifCalendario,
  rifInterrogazione,
  rifInterrogazioni,
  rifMateria,
  rifMaterie,
  salvaCalendario,
  type DatiInterrogazione,
} from '../../src/lib/configurazione'
import { CALENDARIO_DEFAULT, conEccezione } from '../../src/lib/calendar'
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

const domani = () => new Date(Date.now() + 86_400_000)

function datiInterrogazione(extra: Partial<DatiInterrogazione> = {}): DatiInterrogazione {
  return { nome: 'Orale cap. 3', descrizione: '', giorni: [1, 3], perLezione: 3, scadenzaPreferenze: domani(), ...extra }
}

/** Anna capo, Bruno vice, Carla studente, prof. Rossi docente con permesso; una materia "Matematica". */
async function classeConfigurata() {
  const { classId, codice } = await creaClasse(dbDi(env, anna), anna, '4ªB', () => 'AAAAAA')
  for (const p of [bruno, carla, rossi]) await uniscitiConCodice(dbDi(env, p), p, codice)
  await impostaVice(dbDi(env, anna), classId, 'bruno', true)
  await impostaPermessoDocente(dbDi(env, anna), classId, 'rossi', true)
  const subjectId = await creaMateria(dbDi(env, anna), classId, { nome: 'Matematica', orario: [1, 3] })
  return { classId, subjectId }
}

describe('classe appena creata', () => {
  it('il capoclasse salva il primo calendario e crea la prima materia', async () => {
    const { classId } = await creaClasse(dbDi(env, anna), anna, 'Nuova', () => 'NNNNNN')
    await assertSucceeds(salvaCalendario(dbDi(env, anna), classId, CALENDARIO_DEFAULT))
    await assertSucceeds(creaMateria(dbDi(env, anna), classId, { nome: 'Storia', orario: [2] }))
  })
})

describe('calendario', () => {
  it('capo e vice lo salvano, tutti i membri lo leggono', async () => {
    const { classId } = await classeConfigurata()
    const cal = conEccezione(CALENDARIO_DEFAULT, { tipo: 'vacanza', da: '2026-12-23', a: '2027-01-06', descrizione: 'Natale' })
    await assertSucceeds(salvaCalendario(dbDi(env, anna), classId, cal))
    await assertSucceeds(salvaCalendario(dbDi(env, bruno), classId, { ...cal, giorniScolastici: [true, true, true, true, true, true, false] }))
    for (const p of [carla, rossi]) {
      const snap = await assertSucceeds(getDoc(rifCalendario(dbDi(env, p), classId)))
      expect(snap.data()?.eccezioni).toHaveLength(1)
    }
  })

  it('studenti e docenti (anche con permesso) non lo modificano', async () => {
    const { classId } = await classeConfigurata()
    await assertFails(salvaCalendario(dbDi(env, carla), classId, CALENDARIO_DEFAULT))
    await assertFails(salvaCalendario(dbDi(env, rossi), classId, CALENDARIO_DEFAULT))
  })

  it('chi non è della classe non lo legge', async () => {
    const { classId } = await classeConfigurata()
    await salvaCalendario(dbDi(env, anna), classId, CALENDARIO_DEFAULT)
    await assertFails(getDoc(rifCalendario(dbDi(env, bianchi), classId)))
  })

  it('rifiuta dati malformati scritti direttamente', async () => {
    const { classId } = await classeConfigurata()
    const db = dbDi(env, anna)
    const base = { ...CALENDARIO_DEFAULT, aggiornato: serverTimestamp() }
    await assertFails(setDoc(rifCalendario(db, classId), { ...base, giorniScolastici: [true] }))
    await assertFails(setDoc(rifCalendario(db, classId), { ...base, fineAnno: '6 giugno' }))
    await assertFails(setDoc(rifCalendario(db, classId), { ...base, altro: 1 }))
    await assertFails(setDoc(rifCalendario(db, classId), { ...base, uscite: ['14:00'] }))
    await assertFails(setDoc(rifCalendario(db, classId), { ...base, uscite: '14:00' }))
    await assertSucceeds(setDoc(rifCalendario(db, classId), base))
    await assertSucceeds(setDoc(rifCalendario(db, classId), { ...base, uscite: Array(7).fill('13:10') }))
  })

  it('gli orari di uscita si salvano e si rileggono', async () => {
    const { classId } = await classeConfigurata()
    const uscite = ['14:00', '13:10', '14:00', '12:00', '14:00', '14:00', '14:00']
    await assertSucceeds(salvaCalendario(dbDi(env, anna), classId, { ...CALENDARIO_DEFAULT, uscite }))
    expect((await getDoc(rifCalendario(dbDi(env, carla), classId))).data()?.uscite).toEqual(uscite)
    await expect(salvaCalendario(dbDi(env, anna), classId, { ...CALENDARIO_DEFAULT, uscite: ['25:00', ...uscite.slice(1)] })).rejects.toMatchObject({
      codice: 'dati-non-validi',
    })
  })

  it('il sito blocca le vacanze con date invertite prima di scrivere', async () => {
    const { classId } = await classeConfigurata()
    const cal = { ...CALENDARIO_DEFAULT, eccezioni: [{ tipo: 'vacanza' as const, da: '2027-01-06', a: '2026-12-23', descrizione: '' }] }
    await expect(salvaCalendario(dbDi(env, anna), classId, cal)).rejects.toMatchObject({ codice: 'dati-non-validi' })
  })
})

describe('materie', () => {
  it('capo e vice creano, modificano ed eliminano', async () => {
    const { classId, subjectId } = await classeConfigurata()
    const idIta = await assertSucceeds(creaMateria(dbDi(env, bruno), classId, { nome: 'Italiano', orario: [0, 0, 4] }))
    expect((await getDoc(rifMateria(dbDi(env, carla), classId, idIta))).data()).toMatchObject({ nome: 'Italiano', orario: [0, 4] })
    await assertSucceeds(aggiornaMateria(dbDi(env, anna), classId, subjectId, { nome: 'Matematica', orario: [1, 3, 4] }))
    await assertSucceeds(eliminaMateria(dbDi(env, bruno), classId, idIta))
    expect((await getDocs(rifMaterie(dbDi(env, carla), classId))).size).toBe(1)
  })

  it('capo e vice salvano l\'orario di più materie insieme (giorni puliti)', async () => {
    const { classId, subjectId } = await classeConfigurata()
    const idIta = await creaMateria(dbDi(env, anna), classId, { nome: 'Italiano', orario: [] })
    await assertSucceeds(
      aggiornaOrari(dbDi(env, bruno), classId, [
        { subjectId, orario: [0] },
        { subjectId: idIta, orario: [4, 2, 2] },
      ]),
    )
    expect((await getDoc(rifMateria(dbDi(env, carla), classId, idIta))).data()?.orario).toEqual([2, 4])
    await assertFails(aggiornaOrari(dbDi(env, carla), classId, [{ subjectId, orario: [1] }]))
    await assertFails(aggiornaOrari(dbDi(env, rossi), classId, [{ subjectId, orario: [1] }]))
  })

  it('studenti e docenti non toccano le materie', async () => {
    const { classId, subjectId } = await classeConfigurata()
    await assertFails(creaMateria(dbDi(env, carla), classId, { nome: 'Storia', orario: [2] }))
    await assertFails(creaMateria(dbDi(env, rossi), classId, { nome: 'Storia', orario: [2] }))
    await assertFails(aggiornaMateria(dbDi(env, carla), classId, subjectId, { nome: 'X', orario: [] }))
    await assertFails(eliminaMateria(dbDi(env, rossi), classId, subjectId))
  })

  it('niente lezioni di domenica né campi strani', async () => {
    const { classId } = await classeConfigurata()
    const db = dbDi(env, anna)
    await assertFails(addDoc(rifMaterie(db, classId), { nome: 'X', orario: [6], creato: serverTimestamp() }))
    await assertFails(addDoc(rifMaterie(db, classId), { nome: 'X', orario: [1], creato: serverTimestamp(), extra: true }))
    await assertFails(addDoc(rifMaterie(db, classId), { nome: '', orario: [1], creato: serverTimestamp() }))
  })

  it('eliminare una materia elimina le sue interrogazioni', async () => {
    const { classId, subjectId } = await classeConfigurata()
    await creaInterrogazione(dbDi(env, anna), classId, subjectId, datiInterrogazione(), 'anna')
    await assertSucceeds(eliminaMateria(dbDi(env, anna), classId, subjectId))
    expect((await getDocs(rifInterrogazioni(dbDi(env, anna), classId, subjectId))).size).toBe(0)
  })
})

describe('interrogazioni', () => {
  it('capo e vice le creano; tutti i membri le leggono', async () => {
    const { classId, subjectId } = await classeConfigurata()
    const id = await assertSucceeds(creaInterrogazione(dbDi(env, bruno), classId, subjectId, datiInterrogazione(), 'bruno'))
    for (const p of [anna, carla, rossi]) {
      const d = (await getDoc(rifInterrogazione(dbDi(env, p), classId, subjectId, id))).data()
      expect(d).toMatchObject({ nome: 'Orale cap. 3', stato: 'raccolta', giorni: [1, 3], perLezione: 3, creatoDa: 'bruno' })
    }
    await assertFails(getDoc(rifInterrogazione(dbDi(env, bianchi), classId, subjectId, id)))
  })

  it('studenti e docenti (anche con permesso) non le creano', async () => {
    const { classId, subjectId } = await classeConfigurata()
    await assertFails(creaInterrogazione(dbDi(env, carla), classId, subjectId, datiInterrogazione(), 'carla'))
    await assertFails(creaInterrogazione(dbDi(env, rossi), classId, subjectId, datiInterrogazione(), 'rossi'))
  })

  it('numero per lezione e giorni facoltativi', async () => {
    const { classId, subjectId } = await classeConfigurata()
    await assertSucceeds(
      creaInterrogazione(dbDi(env, anna), classId, subjectId, datiInterrogazione({ perLezione: null, giorni: [] }), 'anna'),
    )
  })

  it('la scadenza deve essere nel futuro', async () => {
    const { classId, subjectId } = await classeConfigurata()
    await expect(
      creaInterrogazione(dbDi(env, anna), classId, subjectId, datiInterrogazione({ scadenzaPreferenze: new Date(2020, 0, 1) }), 'anna'),
    ).rejects.toMatchObject({ codice: 'dati-non-validi' })
  })

  it('non si crea già in stato "lista", a nome di altri o in una materia che non esiste', async () => {
    const { classId, subjectId } = await classeConfigurata()
    const db = dbDi(env, anna)
    const base = {
      nome: 'X',
      descrizione: '',
      giorni: [1],
      perLezione: 2,
      scadenzaPreferenze: Timestamp.fromDate(domani()),
      stato: 'raccolta',
      creato: serverTimestamp(),
      creatoDa: 'anna',
      aggiornato: serverTimestamp(),
    }
    await assertFails(addDoc(rifInterrogazioni(db, classId, subjectId), { ...base, stato: 'lista' }))
    await assertFails(addDoc(rifInterrogazioni(db, classId, subjectId), { ...base, creatoDa: 'bruno' }))
    await assertFails(addDoc(rifInterrogazioni(db, classId, 'inesistente'), base))
    await assertFails(addDoc(rifInterrogazioni(db, classId, subjectId), { ...base, perLezione: 0 }))
    await assertFails(addDoc(rifInterrogazioni(db, classId, subjectId), { ...base, perLezione: '3' }))
    await assertSucceeds(addDoc(rifInterrogazioni(db, classId, subjectId), base))
  })

  it('capo e vice modificano ed eliminano; lo stato non si cambia dal sito', async () => {
    const { classId, subjectId } = await classeConfigurata()
    const id = await creaInterrogazione(dbDi(env, anna), classId, subjectId, datiInterrogazione(), 'anna')
    await assertSucceeds(
      aggiornaInterrogazione(dbDi(env, bruno), classId, subjectId, id, datiInterrogazione({ nome: 'Orale cap. 3-4', perLezione: 4 })),
    )
    await assertFails(updateDoc(rifInterrogazione(dbDi(env, anna), classId, subjectId, id), { stato: 'lista', aggiornato: serverTimestamp() }))
    await assertFails(aggiornaInterrogazione(dbDi(env, carla), classId, subjectId, id, datiInterrogazione()))
    await assertFails(eliminaInterrogazione(dbDi(env, rossi), classId, subjectId, id))
    await assertSucceeds(eliminaInterrogazione(dbDi(env, bruno), classId, subjectId, id))
  })
})
