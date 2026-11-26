import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { getDoc, getDocs, serverTimestamp, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import {
  creaClasse,
  impostaMaterieDocente,
  impostaPermessoDocente,
  impostaSostegno,
  impostaVice,
  richiediPermesso,
  rifMembro,
  uniscitiConCodice,
} from '../../src/lib/classi'
import {
  creaInterrogazione,
  creaMateria,
  rifCalendario,
  rifInterrogazione,
  rifLista,
  rifSegnalazioni,
  salvaCalendario,
  segnaGiornoSenzaInterrogazioni,
  togliGiornoSenzaInterrogazioni,
} from '../../src/lib/configurazione'
import { CALENDARIO_DEFAULT, conEccezione, type Calendario } from '../../src/lib/calendar'
import { riordinaLista, salvaLezione, segnalaInterrogato, segnaSaltato, togliInterrogato } from '../../src/lib/gestioneLista'
import { aggiungiVoceStorico } from '../../src/lib/storico'
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

/**
 * Anna capo, Bruno vice, Carla studente; il prof. Rossi ha la materia Matematica,
 * la prof. Bianchi ha il permesso di riordinare ma nessuna materia. Calendario salvato.
 */
async function classe() {
  const { classId, codice } = await creaClasse(dbDi(env, anna), anna, '4ªB', () => 'AAAAAA')
  for (const p of [bruno, carla, rossi, bianchi]) await uniscitiConCodice(dbDi(env, p), p, codice)
  await impostaVice(dbDi(env, anna), classId, 'bruno', true)
  await impostaPermessoDocente(dbDi(env, anna), classId, 'bianchi', true)
  await salvaCalendario(dbDi(env, anna), classId, CALENDARIO_DEFAULT)
  const subjectId = await creaMateria(dbDi(env, anna), classId, { nome: 'Matematica', orario: [1, 3] })
  const altra = await creaMateria(dbDi(env, anna), classId, { nome: 'Storia', orario: [2] })
  await impostaMaterieDocente(dbDi(env, anna), classId, 'rossi', [subjectId])
  return { classId, subjectId, altra }
}

/** La classe con una lista di Matematica già generata (Anna, Bruno, Carla). */
async function listaPronta() {
  const c = await classe()
  const interrogazioneId = await creaInterrogazione(
    dbDi(env, anna),
    c.classId,
    c.subjectId,
    { nome: 'Orale', descrizione: '', giorni: [1, 3], perLezione: 1, scadenzaPreferenze: new Date(Date.now() + 3_600_000) },
    'anna',
  )
  const r = { classId: c.classId, subjectId: c.subjectId, interrogazioneId }
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(rifInterrogazione(ctx.firestore() as unknown as Firestore, c.classId, c.subjectId, interrogazioneId), {
      scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    })
  })
  const { ordine } = await generaEPubblicaLista(dbDi(env, anna), r, 'anna', 1)
  return { ...c, r, ordine }
}

async function calendario(classId: string): Promise<Calendario> {
  return (await getDoc(rifCalendario(dbDi(env, anna), classId))).data() as Calendario
}

describe('materie dei docenti', () => {
  it('le assegna solo il capoclasse, solo ai docenti', async () => {
    const { classId, subjectId, altra } = await classe()
    expect((await getDoc(rifMembro(dbDi(env, anna), classId, 'rossi'))).data()?.materie).toEqual([subjectId])
    await assertSucceeds(impostaMaterieDocente(dbDi(env, anna), classId, 'rossi', [subjectId, altra]))
    await assertFails(impostaMaterieDocente(dbDi(env, bruno), classId, 'bianchi', [subjectId])) // il vice no
    await assertFails(impostaMaterieDocente(dbDi(env, bianchi), classId, 'bianchi', [subjectId])) // da sola no
    await assertFails(impostaMaterieDocente(dbDi(env, anna), classId, 'carla', [subjectId])) // a uno studente no
    // insieme ad altro (per esempio il permesso) no
    await assertFails(updateDoc(rifMembro(dbDi(env, anna), classId, 'rossi'), { materie: [altra], ruolo: 'vice' }))
  })
})

describe('giorni senza interrogazioni', () => {
  it('il docente della materia li segna e li toglie', async () => {
    const { classId, subjectId } = await classe()
    const g = { data: '2026-11-19', subjectId, motivo: 'verifica' as const, chi: 'rossi' }
    const e = await assertSucceeds(segnaGiornoSenzaInterrogazioni(dbDi(env, rossi), classId, g, false))
    expect((await calendario(classId)).eccezioni).toEqual([{ tipo: 'lezione-annullata', ...g }])
    await assertSucceeds(togliGiornoSenzaInterrogazioni(dbDi(env, rossi), classId, e))
    expect((await calendario(classId)).eccezioni).toEqual([])
  })

  it('capo e vice in tutte le materie; gli altri docenti e gli studenti no', async () => {
    const { classId, subjectId, altra } = await classe()
    await assertSucceeds(segnaGiornoSenzaInterrogazioni(dbDi(env, anna), classId, { data: '2026-11-18', subjectId: altra, motivo: 'altro', chi: 'anna' }, true))
    await assertSucceeds(segnaGiornoSenzaInterrogazioni(dbDi(env, bruno), classId, { data: '2026-11-19', subjectId, motivo: 'spiegazione', chi: 'bruno' }, true))
    const g = { data: '2026-11-24', subjectId, motivo: 'verifica' as const }
    await assertFails(segnaGiornoSenzaInterrogazioni(dbDi(env, rossi), classId, { ...g, subjectId: altra, chi: 'rossi' }, false)) // non è sua
    await assertFails(segnaGiornoSenzaInterrogazioni(dbDi(env, bianchi), classId, { ...g, chi: 'bianchi' }, false)) // permesso sì, materia no
    await assertFails(segnaGiornoSenzaInterrogazioni(dbDi(env, carla), classId, { ...g, chi: 'carla' }, false))
    // il docente toglie solo quelli delle sue materie
    const diAnna = (await calendario(classId)).eccezioni.find((e) => e.tipo === 'lezione-annullata' && e.subjectId === altra)!
    await assertFails(togliGiornoSenzaInterrogazioni(dbDi(env, rossi), classId, diAnna as never))
    const diBruno = (await calendario(classId)).eccezioni.find((e) => e.tipo === 'lezione-annullata' && e.subjectId === subjectId)!
    await assertSucceeds(togliGiornoSenzaInterrogazioni(dbDi(env, rossi), classId, diBruno as never))
  })

  it('il docente non tocca nient\'altro del calendario', async () => {
    const { classId, subjectId } = await classe()
    const db = dbDi(env, rossi)
    const rif = rifCalendario(db, classId)
    const prima = await calendario(classId)
    const conVacanza = conEccezione(prima, { tipo: 'vacanza', da: '2026-12-01', a: '2026-12-01', descrizione: 'Ponte' })
    await assertFails(updateDoc(rif, { eccezioni: conVacanza.eccezioni, aggiornato: serverTimestamp() }))
    const extra = conEccezione(prima, { tipo: 'lezione-extra', data: '2026-12-01', subjectId })
    await assertFails(updateDoc(rif, { eccezioni: extra.eccezioni, aggiornato: serverTimestamp() }))
    // a nome di un altro, o due giorni insieme
    const aNomeDi = conEccezione(prima, { tipo: 'lezione-annullata', data: '2026-12-01', subjectId, motivo: 'verifica', chi: 'anna' })
    await assertFails(updateDoc(rif, { eccezioni: aNomeDi.eccezioni, aggiornato: serverTimestamp() }))
    const due = conEccezione(conEccezione(prima, { tipo: 'lezione-annullata', data: '2026-12-01', subjectId, chi: 'rossi' }), {
      tipo: 'lezione-annullata',
      data: '2026-12-03',
      subjectId,
      chi: 'rossi',
    })
    await assertFails(updateDoc(rif, { eccezioni: due.eccezioni, aggiornato: serverTimestamp() }))
    await assertFails(updateDoc(rif, { fineAnno: '2027-05-01', aggiornato: serverTimestamp() }))
    await assertFails(updateDoc(rif, { giorniScolastici: [true, true, true, true, true, true, false], aggiornato: serverTimestamp() }))
  })

  it('il docente non crea il calendario se il capoclasse non l\'ha mai salvato', async () => {
    const { classId, codice } = await creaClasse(dbDi(env, anna), anna, 'Nuova', () => 'NNNNNN')
    await uniscitiConCodice(dbDi(env, rossi), rossi, codice)
    const subjectId = await creaMateria(dbDi(env, anna), classId, { nome: 'Fisica', orario: [1] })
    await impostaMaterieDocente(dbDi(env, anna), classId, 'rossi', [subjectId])
    await expect(
      segnaGiornoSenzaInterrogazioni(dbDi(env, rossi), classId, { data: '2026-11-17', subjectId, motivo: 'verifica', chi: 'rossi' }, false),
    ).rejects.toThrow(/calendario/)
    // il capoclasse sì: il calendario nasce con il giorno segnato
    await assertSucceeds(segnaGiornoSenzaInterrogazioni(dbDi(env, anna), classId, { data: '2026-11-17', subjectId, motivo: 'verifica', chi: 'anna' }, true))
  })
})

describe('il docente della materia e gli interrogati', () => {
  it('segna, chiude la lezione con "Fine", la modifica e conferma le segnalazioni', async () => {
    const { r, ordine } = await listaPronta()
    const db = dbDi(env, rossi)
    const annulla = await assertSucceeds(salvaLezione(db, r, { data: '2026-11-03', segna: [ordine[0]!], togli: [], chiudi: true }, 'rossi'))
    let l = (await getDoc(rifLista(db, r.classId, r.subjectId, r.interrogazioneId))).data()!
    expect(l.interrogati).toEqual({ [ordine[0]!]: '2026-11-03' })
    expect(l.chiusi).toEqual(['2026-11-03'])
    // "Annulla": tolto il segno e riaperta
    await assertSucceeds(annulla())
    l = (await getDoc(rifLista(db, r.classId, r.subjectId, r.interrogazioneId))).data()!
    expect(l.interrogati).toEqual({})
    expect(l.chiusi).toEqual([])
    // "Fine" anche senza nessuno interrogato
    await assertSucceeds(salvaLezione(db, r, { data: '2026-11-05', segna: [], togli: [], chiudi: true }, 'rossi'))
    // la segnalazione di Carla: la vede e la conferma
    await segnalaInterrogato(dbDi(env, carla), r, 'carla', '2026-11-05')
    expect((await assertSucceeds(getDocs(rifSegnalazioni(db, r.classId, r.subjectId, r.interrogazioneId)))).size).toBe(1)
    await assertSucceeds(salvaLezione(db, r, { data: '2026-11-05', segna: ['carla'], togli: [] }, 'rossi'))
    await assertSucceeds(togliInterrogato(db, r, 'carla', 'rossi'))
  })

  it('quando sono tutti interrogati chiude anche l\'interrogazione', async () => {
    const { r, ordine } = await listaPronta()
    await assertSucceeds(salvaLezione(dbDi(env, rossi), r, { data: '2026-11-05', segna: ordine, togli: [], chiudi: true }, 'rossi'))
    expect((await getDoc(rifInterrogazione(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId))).data()?.stato).toBe('conclusa')
  })

  it('non riordina senza permesso e non segna "ha saltato"', async () => {
    const { r, ordine } = await listaPronta()
    await assertFails(riordinaLista(dbDi(env, rossi), r, [...ordine].reverse(), 'rossi'))
    await assertFails(segnaSaltato(dbDi(env, rossi), r, ordine[0]!, '2026-11-03', '2026-11-05', 'rossi'))
    // riordino travestito: ordine cambiato insieme agli interrogati
    const db = dbDi(env, rossi)
    const batch = writeBatch(db)
    const voce = aggiungiVoceStorico(db, batch, r, 'rossi', 'lezione', { data: '2026-11-03', uids: [] })
    batch.update(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), {
      ordine: [...ordine].reverse(),
      chiusi: ['2026-11-03'],
      aggiornato: serverTimestamp(),
      aggiornatoDa: 'rossi',
      ultimaModifica: voce,
    })
    await assertFails(batch.commit())
    // né una voce di storico falsa ("ha spostato…") insieme a una modifica permessa
    const b2 = writeBatch(db)
    const falsa = aggiungiVoceStorico(db, b2, r, 'rossi', 'riordino', { spostati: [{ uid: ordine[0]!, da: 1, a: 3 }] })
    b2.update(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), {
      chiusi: ['2026-11-03'],
      aggiornato: serverTimestamp(),
      aggiornatoDa: 'rossi',
      ultimaModifica: falsa,
    })
    await assertFails(b2.commit())
  })

  it('gli altri docenti (anche con permesso) e gli studenti non segnano né chiudono', async () => {
    const { r, ordine } = await listaPronta()
    for (const p of [bianchi, carla]) {
      await assertFails(salvaLezione(dbDi(env, p), r, { data: '2026-11-03', segna: [ordine[0]!], togli: [] }, p.uid))
      await assertFails(salvaLezione(dbDi(env, p), r, { data: '2026-11-03', segna: [], togli: [], chiudi: true }, p.uid))
      await assertFails(getDocs(rifSegnalazioni(dbDi(env, p), r.classId, r.subjectId, r.interrogazioneId)))
    }
    // capo e vice sì
    await assertSucceeds(salvaLezione(dbDi(env, bruno), r, { data: '2026-11-03', segna: [], togli: [], chiudi: true }, 'bruno'))
  })

  it('tolta la materia, il docente non segna più', async () => {
    const { r, ordine, classId, altra } = await listaPronta()
    await impostaMaterieDocente(dbDi(env, anna), classId, 'rossi', [altra])
    await assertFails(salvaLezione(dbDi(env, rossi), r, { data: '2026-11-03', segna: [ordine[0]!], togli: [] }, 'rossi'))
    await assertFails(getDocs(rifSegnalazioni(dbDi(env, rossi), r.classId, r.subjectId, r.interrogazioneId)))
  })
})

describe('docente di sostegno', () => {
  it('lo segna solo il capoclasse: niente materie e niente permesso di riordinare', async () => {
    const { classId, subjectId } = await classe()
    await assertFails(impostaSostegno(dbDi(env, bruno), classId, 'rossi', true)) // il vice no
    await assertFails(impostaSostegno(dbDi(env, rossi), classId, 'rossi', true)) // da solo no
    await assertFails(impostaSostegno(dbDi(env, anna), classId, 'carla', true)) // a uno studente no
    // Bianchi aveva il permesso di riordinare: diventando di sostegno lo perde
    await assertSucceeds(impostaSostegno(dbDi(env, anna), classId, 'bianchi', true))
    const b = (await getDoc(rifMembro(dbDi(env, anna), classId, 'bianchi'))).data()
    expect(b).toMatchObject({ sostegno: true, materie: [], permessoModifica: false, richiestaPermesso: false })
    // di sostegno ma con una materia, o tenendo il permesso: no
    await assertFails(updateDoc(rifMembro(dbDi(env, anna), classId, 'rossi'), { sostegno: true, materie: [subjectId] }))
    await assertFails(
      updateDoc(rifMembro(dbDi(env, anna), classId, 'rossi'), { sostegno: true, materie: [], permessoModifica: true, richiestaPermesso: false }),
    )
    // il permesso non si chiede e non si dà
    await assertFails(richiediPermesso(dbDi(env, bianchi), classId, 'bianchi', true))
    await assertFails(impostaPermessoDocente(dbDi(env, anna), classId, 'bianchi', true))
    // assegnando una materia non è più di sostegno; e si può anche solo togliere
    await assertSucceeds(impostaMaterieDocente(dbDi(env, anna), classId, 'bianchi', [subjectId]))
    expect((await getDoc(rifMembro(dbDi(env, anna), classId, 'bianchi'))).data()).toMatchObject({ sostegno: false, materie: [subjectId] })
    await assertSucceeds(impostaSostegno(dbDi(env, anna), classId, 'bianchi', true))
    await assertSucceeds(impostaSostegno(dbDi(env, anna), classId, 'bianchi', false))
    await assertSucceeds(impostaPermessoDocente(dbDi(env, anna), classId, 'bianchi', true))
  })

  it('vede le liste ma non segna, non chiude e non riordina (nemmeno con materia o permesso forzati)', async () => {
    const { r, ordine, classId, subjectId } = await listaPronta()
    await impostaSostegno(dbDi(env, anna), classId, 'rossi', true)
    // se per assurdo avesse ancora la materia e il permesso, non varrebbero
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(rifMembro(ctx.firestore() as unknown as Firestore, classId, 'rossi'), { materie: [subjectId], permessoModifica: true })
    })
    const db = dbDi(env, rossi)
    await assertSucceeds(getDoc(rifLista(db, r.classId, r.subjectId, r.interrogazioneId)))
    await assertFails(salvaLezione(db, r, { data: '2026-11-03', segna: [ordine[0]!], togli: [] }, 'rossi'))
    await assertFails(salvaLezione(db, r, { data: '2026-11-03', segna: [], togli: [], chiudi: true }, 'rossi'))
    await assertFails(riordinaLista(db, r, [...ordine].reverse(), 'rossi'))
    await assertFails(getDocs(rifSegnalazioni(db, r.classId, r.subjectId, r.interrogazioneId)))
    await assertFails(segnaGiornoSenzaInterrogazioni(db, classId, { data: '2026-11-19', subjectId, motivo: 'verifica', chi: 'rossi' }, false))
  })
})
