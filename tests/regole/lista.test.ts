import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { aggiungiVoceStorico } from '../../src/lib/storico'
import { creaClasse, impostaDSA, impostaGiorniAssenza, impostaPermessoDocente, impostaVice, uniscitiConCodice } from '../../src/lib/classi'
import {
  creaInterrogazione,
  creaMateria,
  eliminaInterrogazione,
  impostaEsclusi,
  rifInterrogazione,
  rifInterrogazioni,
  rifLista,
  rifSegnalazione,
  rifSegnalazioni,
  rifStorico,
} from '../../src/lib/configurazione'
import { dichiaraAssenza, gestisciImprevisto, riordinaLista, segnaSaltato, segnaInterrogati, segnalaInterrogato, togliInterrogato, togliSegnalazione } from '../../src/lib/gestioneLista'
import { creaSenzaLista, generaEPubblicaLista, salvaPreferenza } from '../../src/lib/preferenze'
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

/** Anna capo, Bruno vice, Carla studente, Rossi docente (senza permesso), Bianchi docente con permesso; lista generata. */
async function listaPronta(o: { carlaConData?: boolean } = {}) {
  const { classId, codice } = await creaClasse(dbDi(env, anna), anna, '4ªB', () => 'AAAAAA')
  for (const p of [bruno, carla, rossi, bianchi]) await uniscitiConCodice(dbDi(env, p), p, codice)
  await impostaVice(dbDi(env, anna), classId, 'bruno', true)
  await impostaPermessoDocente(dbDi(env, anna), classId, 'bianchi', true)
  const subjectId = await creaMateria(dbDi(env, anna), classId, { nome: 'Matematica', orario: [1] })
  const interrogazioneId = await creaInterrogazione(dbDi(env, anna), classId, subjectId, {
    nome: 'Orale',
    descrizione: '',
    giorni: [1],
    perLezione: 1,
    scadenzaPreferenze: new Date(Date.now() + 3_600_000),
  }, 'anna')
  const r = { classId, subjectId, interrogazioneId }
  if (o.carlaConData) {
    await impostaDSA(dbDi(env, anna), classId, 'carla', true, 'anna')
    await salvaPreferenza(dbDi(env, carla), r, 'carla', 'data', '2026-11-10')
  }
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(rifInterrogazione(ctx.firestore() as unknown as Firestore, classId, subjectId, interrogazioneId), {
      scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() - 60_000)),
    })
  })
  const { ordine } = await generaEPubblicaLista(dbDi(env, anna), r, 'anna', 1)
  return { r, ordine }
}

async function lista(r: { classId: string; subjectId: string; interrogazioneId: string }) {
  return (await getDoc(rifLista(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId))).data()!
}
async function stato(r: { classId: string; subjectId: string; interrogazioneId: string }) {
  return (await getDoc(rifInterrogazione(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId))).data()!.stato
}

describe('riordino', () => {
  it('capo, vice e docenti con permesso riordinano', async () => {
    const { r, ordine } = await listaPronta()
    const inverso = [...ordine].reverse()
    await assertSucceeds(riordinaLista(dbDi(env, anna), r, inverso, 'anna'))
    expect((await lista(r)).ordine).toEqual(inverso)
    await assertSucceeds(riordinaLista(dbDi(env, bruno), r, ordine, 'bruno'))
    await assertSucceeds(riordinaLista(dbDi(env, bianchi), r, inverso, 'bianchi'))
  })

  it('studenti e docenti senza permesso no', async () => {
    const { r, ordine } = await listaPronta()
    await assertFails(riordinaLista(dbDi(env, carla), r, [...ordine].reverse(), 'carla'))
    await assertFails(riordinaLista(dbDi(env, rossi), r, [...ordine].reverse(), 'rossi'))
  })

  it('non si toglie, aggiunge o duplica nessuno', async () => {
    const { r, ordine } = await listaPronta()
    const rif = rifLista(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId)
    const base = { aggiornato: serverTimestamp(), aggiornatoDa: 'anna' }
    await assertFails(updateDoc(rif, { ...base, ordine: ordine.slice(1) }))
    await assertFails(updateDoc(rif, { ...base, ordine: [...ordine.slice(1), 'intruso'] }))
    await assertFails(updateDoc(rif, { ...base, ordine: [ordine[0], ordine[0], ordine[2]] }))
    await assertFails(updateDoc(rif, { ...base, ordine: [...ordine].reverse(), aggiornatoDa: 'bruno' }))
    await assertFails(updateDoc(rif, { ...base, generataDa: 'bruno' }))
  })
})

describe('interrogati', () => {
  it('il capo segna gli interrogati; quando ci sono tutti l\'interrogazione è conclusa', async () => {
    const { r, ordine } = await listaPronta()
    await assertSucceeds(segnaInterrogati(dbDi(env, anna), r, [ordine[0]!], '2026-11-03', 'anna'))
    expect((await lista(r)).interrogati).toEqual({ [ordine[0]!]: '2026-11-03' })
    expect(await stato(r)).toBe('lista')
    await assertSucceeds(segnaInterrogati(dbDi(env, bruno), r, ordine.slice(1), '2026-11-10', 'bruno'))
    expect(await stato(r)).toBe('conclusa')
    // tolto uno, torna "lista"
    await assertSucceeds(togliInterrogato(dbDi(env, bruno), r, ordine[2]!, 'bruno'))
    expect(await stato(r)).toBe('lista')
    expect(Object.keys((await lista(r)).interrogati)).toHaveLength(2)
  })

  it('i docenti con permesso riordinano ma non segnano né confermano', async () => {
    const { r, ordine } = await listaPronta()
    await assertFails(segnaInterrogati(dbDi(env, bianchi), r, [ordine[0]!], '2026-11-03', 'bianchi'))
    await segnalaInterrogato(dbDi(env, carla), r, 'carla', '2026-11-03')
    await assertFails(getDocs(rifSegnalazioni(dbDi(env, bianchi), r.classId, r.subjectId, r.interrogazioneId)))
    await assertFails(togliSegnalazione(dbDi(env, bianchi), r, 'carla'))
    await assertSucceeds(riordinaLista(dbDi(env, bianchi), r, [...ordine].reverse(), 'bianchi'))
    await segnaInterrogati(dbDi(env, anna), r, [ordine[0]!], '2026-11-03', 'anna')
    await assertFails(togliInterrogato(dbDi(env, bianchi), r, ordine[0]!, 'bianchi'))
  })

  it('studenti e docenti senza permesso non segnano', async () => {
    const { r, ordine } = await listaPronta()
    await assertFails(segnaInterrogati(dbDi(env, carla), r, [ordine[0]!], '2026-11-03', 'carla'))
    await assertFails(segnaInterrogati(dbDi(env, rossi), r, [ordine[0]!], '2026-11-03', 'rossi'))
    // modificando solo la lista, senza toccare le segnalazioni
    for (const p of [carla, rossi]) {
      await assertFails(
        updateDoc(rifLista(dbDi(env, p), r.classId, r.subjectId, r.interrogazioneId), {
          interrogati: { [p.uid]: '2026-11-03' },
          aggiornato: serverTimestamp(),
          aggiornatoDa: p.uid,
        }),
      )
    }
  })

  it('si segnano solo persone della lista', async () => {
    const { r } = await listaPronta()
    await assertFails(segnaInterrogati(dbDi(env, anna), r, ['intruso'], '2026-11-03', 'anna'))
  })

  it('"conclusa" solo se sono davvero tutti interrogati', async () => {
    const { r } = await listaPronta()
    await assertFails(
      updateDoc(rifInterrogazione(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId), {
        stato: 'conclusa',
        aggiornato: serverTimestamp(),
      }),
    )
  })
})

describe('"Sono stato interrogato"', () => {
  it('lo studente lo segnala, il capo conferma e la segnalazione sparisce', async () => {
    const { r } = await listaPronta()
    await assertSucceeds(segnalaInterrogato(dbDi(env, carla), r, 'carla', '2026-11-03'))
    await assertSucceeds(getDoc(rifSegnalazione(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId, 'carla')))
    expect((await getDocs(rifSegnalazioni(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId))).size).toBe(1)
    await assertSucceeds(segnaInterrogati(dbDi(env, anna), r, ['carla'], '2026-11-03', 'anna'))
    expect((await getDocs(rifSegnalazioni(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId))).size).toBe(0)
  })

  it('il capo può rifiutarla, lo studente ritirarla', async () => {
    const { r } = await listaPronta()
    await segnalaInterrogato(dbDi(env, carla), r, 'carla', '2026-11-03')
    await assertSucceeds(togliSegnalazione(dbDi(env, bruno), r, 'carla'))
    await segnalaInterrogato(dbDi(env, carla), r, 'carla', '2026-11-03')
    await assertSucceeds(togliSegnalazione(dbDi(env, carla), r, 'carla'))
  })

  it('solo per sé, solo se in lista e non già interrogato; gli altri studenti non le vedono', async () => {
    const { r } = await listaPronta()
    await assertFails(segnalaInterrogato(dbDi(env, carla), r, 'bruno', '2026-11-03'))
    await assertFails(segnalaInterrogato(dbDi(env, rossi), r, 'rossi', '2026-11-03'))
    await segnalaInterrogato(dbDi(env, carla), r, 'carla', '2026-11-03')
    await assertFails(getDoc(rifSegnalazione(dbDi(env, rossi), r.classId, r.subjectId, r.interrogazioneId, 'carla')))
    await assertFails(getDocs(rifSegnalazioni(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId)))
    await assertFails(togliSegnalazione(dbDi(env, rossi), r, 'carla'))
    await segnaInterrogati(dbDi(env, anna), r, ['carla'], '2026-11-03', 'anna')
    await assertFails(segnalaInterrogato(dbDi(env, carla), r, 'carla', '2026-11-03'))
    await assertFails(
      setDoc(rifSegnalazione(dbDi(env, bruno), r.classId, r.subjectId, r.interrogazioneId, 'bruno'), {
        data: 'ieri',
        quando: serverTimestamp(),
      }),
    )
  })

  it('eliminando l\'interrogazione spariscono anche le segnalazioni', async () => {
    const { r } = await listaPronta()
    await segnalaInterrogato(dbDi(env, carla), r, 'carla', '2026-11-03')
    await assertSucceeds(eliminaInterrogazione(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId))
  })
})

describe('data fissa (DSA/BES)', () => {
  it('chi ha la data fissa si segna come gli altri; conclusa solo quando ci sono anche loro', async () => {
    const { r, ordine } = await listaPronta({ carlaConData: true })
    expect(ordine).toEqual(expect.not.arrayContaining(['carla']))
    expect((await lista(r)).fissi).toEqual({ carla: '2026-11-10' })
    await assertSucceeds(segnaInterrogati(dbDi(env, anna), r, ordine, '2026-11-03', 'anna'))
    expect(await stato(r)).toBe('lista')
    // "conclusa" scritta a mano mentre manca Carla: no
    await assertFails(
      updateDoc(rifInterrogazione(dbDi(env, anna), r.classId, r.subjectId, r.interrogazioneId), { stato: 'conclusa', aggiornato: serverTimestamp() }),
    )
    await assertSucceeds(segnaInterrogati(dbDi(env, bruno), r, ['carla'], '2026-11-10', 'bruno'))
    expect(await stato(r)).toBe('conclusa')
    await assertSucceeds(togliInterrogato(dbDi(env, anna), r, 'carla', 'anna'))
    expect(await stato(r)).toBe('lista')
  })

  it('il riordino non sposta né aggiunge chi ha la data fissa, e le date fisse non si cambiano', async () => {
    const { r, ordine } = await listaPronta({ carlaConData: true })
    // il sito lo blocca prima di scrivere…
    await expect(riordinaLista(dbDi(env, anna), r, [...ordine, 'carla'], 'anna')).rejects.toMatchObject({ codice: 'dati-non-validi' })
    // …e le regole anche scrivendo direttamente (con la voce di storico, come farebbe il sito)
    {
      const db = dbDi(env, anna)
      const b = writeBatch(db)
      const voce = aggiungiVoceStorico(db, b, r, 'anna', 'riordino', {})
      b.update(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), {
        ordine: [...ordine.slice(1), 'carla'], aggiornato: serverTimestamp(), aggiornatoDa: 'anna', ultimaModifica: voce,
      })
      await assertFails(b.commit())
    }
    await assertSucceeds(riordinaLista(dbDi(env, anna), r, [...ordine].reverse(), 'anna'))
    const db = dbDi(env, anna)
    await assertFails(updateDoc(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), { fissi: { carla: '2026-12-01' } }))
    expect((await lista(r)).fissi).toEqual({ carla: '2026-11-10' })
  })

  it('anche chi ha la data fissa può dire "sono stato interrogato"', async () => {
    const { r } = await listaPronta({ carlaConData: true })
    await assertSucceeds(segnalaInterrogato(dbDi(env, carla), r, 'carla', '2026-11-10'))
  })
})

describe('imprevisti (solo capo e vice)', () => {
  it('capo e vice rimettono, fissano una data e tolgono; docenti con permesso e studenti no', async () => {
    const { r, ordine } = await listaPronta()
    const [primo] = ordine
    await assertSucceeds(gestisciImprevisto(dbDi(env, anna), r, { tipo: 'fissa', uid: primo!, data: '2026-11-17' }, 'anna'))
    expect((await lista(r)).fissi).toEqual({ [primo!]: '2026-11-17' })
    expect((await lista(r)).ordine).not.toContain(primo)
    await assertSucceeds(gestisciImprevisto(dbDi(env, bruno), r, { tipo: 'aggiungi', uid: primo! }, 'bruno'))
    expect((await lista(r)).ordine.at(-1)).toBe(primo)
    expect((await lista(r)).fissi).toEqual({})
    for (const p of [bianchi, carla, rossi]) {
      await assertFails(gestisciImprevisto(dbDi(env, p), r, { tipo: 'togli', uid: primo! }, p.uid))
      await assertFails(gestisciImprevisto(dbDi(env, p), r, { tipo: 'fissa', uid: primo!, data: '2026-11-17' }, p.uid))
    }
    await assertSucceeds(gestisciImprevisto(dbDi(env, anna), r, { tipo: 'togli', uid: primo! }, 'anna'))
    expect((await lista(r)).ordine).toHaveLength(ordine.length - 1)
  })

  it('togliere chi manca conclude; rimettere qualcuno riapre', async () => {
    const { r, ordine } = await listaPronta()
    const [a, b, c] = ordine as [string, string, string]
    await segnaInterrogati(dbDi(env, anna), r, [a, b], '2026-11-03', 'anna')
    await assertSucceeds(gestisciImprevisto(dbDi(env, anna), r, { tipo: 'togli', uid: c }, 'anna'))
    expect(await stato(r)).toBe('conclusa')
    await assertSucceeds(gestisciImprevisto(dbDi(env, anna), r, { tipo: 'aggiungi', uid: c }, 'anna'))
    expect(await stato(r)).toBe('lista')
    // togliere un interrogato toglie anche il segno
    await assertSucceeds(gestisciImprevisto(dbDi(env, anna), r, { tipo: 'togli', uid: a }, 'anna'))
    expect((await lista(r)).interrogati).toEqual({ [b]: '2026-11-03' })
  })

  it('scritto direttamente: niente doppioni, niente persona in ordine e con data, niente senza storico', async () => {
    const { r, ordine } = await listaPronta()
    const db = dbDi(env, anna)
    const prova = async (dati: Record<string, unknown>, conStorico = true) => {
      const b = writeBatch(db)
      const voce = conStorico ? aggiungiVoceStorico(db, b, r, 'anna', 'aggiunto', {}) : 'inventata'
      b.update(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), {
        aggiornato: serverTimestamp(), aggiornatoDa: 'anna', ultimaModifica: voce, ...dati,
      })
      return b.commit()
    }
    await assertFails(prova({ ordine: [...ordine, ordine[0]] }))
    await assertFails(prova({ fissi: { [ordine[0]!]: '2026-11-10' } }))
    await assertFails(prova({ ordine: [...ordine, 'nuovo'] }, false))
    await assertFails(prova({ interrogati: { estraneo: '2026-11-03' } }))
    await assertSucceeds(prova({ ordine: [...ordine, 'nuovo'] }))
  })
})

describe('"non ci sarò"', () => {
  type R = { classId: string; subjectId: string; interrogazioneId: string }
  /** Scrive direttamente, come farebbe qualcuno che salta il sito. */
  async function scrivi(r: R, chi: { uid: string; email: string }, campi: Record<string, unknown>, uid: string = chi.uid) {
    const d = dbDi(env, chi)
    const batch = writeBatch(d)
    const voce = aggiungiVoceStorico(d, batch, r, chi.uid, 'assenza', { uid })
    batch.update(rifLista(d, r.classId, r.subjectId, r.interrogazioneId), {
      aggiornato: serverTimestamp(),
      aggiornatoDa: chi.uid,
      ultimaModifica: voce,
      ...campi,
    })
    return batch.commit()
  }

  it('lo studente in lista esce dall\'ordine e prende la data fissa; resta traccia nello storico', async () => {
    const { r } = await listaPronta()
    const voci = () => getDocs(rifStorico(dbDi(env, carla), r.classId, r.subjectId, r.interrogazioneId))
    const prima = (await voci()).size
    await assertSucceeds(dichiaraAssenza(dbDi(env, carla), r, 'carla', '2026-11-10', '2026-11-17'))
    const l = await lista(r)
    expect(l.ordine).not.toContain('carla')
    expect(l.fissi).toEqual({ carla: '2026-11-17' })
    expect((await voci()).size).toBe(prima + 1)
  })
  it('chi ha già una data fissa può solo spostarla più avanti', async () => {
    const { r } = await listaPronta({ carlaConData: true })
    await assertFails(scrivi(r, carla, { fissi: { carla: '2026-11-03' } }))
    await assertSucceeds(dichiaraAssenza(dbDi(env, carla), r, 'carla', '2026-11-10', '2026-11-17'))
  })
  it('solo per sé stessi, e mai toccando gli altri', async () => {
    const { r, ordine } = await listaPronta()
    const senza = (u: string) => ordine.filter((x) => x !== u)
    await assertFails(scrivi(r, carla, { ordine: senza('bruno'), fissi: { bruno: '2026-11-17' } }, 'bruno'))
    await assertFails(scrivi(r, carla, { ordine: senza('carla'), fissi: { carla: '2026-11-17', bruno: '2026-11-17' } }))
    await assertFails(scrivi(r, carla, { ordine: [...senza('carla')].reverse(), fissi: { carla: '2026-11-17' } }))
    await assertFails(scrivi(r, carla, { ordine: senza('carla'), fissi: { carla: 'domani' } }))
    await assertFails(scrivi(r, rossi, { ordine, fissi: { prof: '2026-11-17' } }))
  })
  it('chi è già stato interrogato non può più', async () => {
    const { r, ordine } = await listaPronta()
    await segnaInterrogati(dbDi(env, anna), r, ['carla'], '2026-11-03', 'anna')
    await assertFails(scrivi(r, carla, { ordine: ordine.filter((x) => x !== 'carla'), fissi: { carla: '2026-11-17' } }))
  })
  it('dopo il termine il contatore sale di uno, e solo il proprio', async () => {
    const { r, ordine } = await listaPronta()
    const senza = ordine.filter((x) => x !== 'carla')
    await assertFails(scrivi(r, carla, { ordine: senza, fissi: { carla: '2026-11-17' }, ritardi: { carla: 5 } }))
    await assertFails(scrivi(r, carla, { ordine: senza, fissi: { carla: '2026-11-17' }, ritardi: { carla: 1, bruno: 1 } }))
    await assertSucceeds(dichiaraAssenza(dbDi(env, carla), r, 'carla', '2026-11-10', '2026-11-17', true))
    await assertSucceeds(dichiaraAssenza(dbDi(env, carla), r, 'carla', '2026-11-17', '2026-11-24', true))
    expect((await lista(r)).ritardi).toEqual({ carla: 2 })
  })
  it('"ha saltato": solo capo e vice; si può annullare', async () => {
    const { r } = await listaPronta()
    await assertFails(segnaSaltato(dbDi(env, carla), r, 'bruno', '2026-11-10', '2026-11-17', 'carla'))
    await assertFails(segnaSaltato(dbDi(env, bianchi), r, 'bruno', '2026-11-10', '2026-11-17', 'bianchi'))
    const annulla = await assertSucceeds(segnaSaltato(dbDi(env, bruno), r, 'carla', '2026-11-10', '2026-11-17', 'bruno'))
    let l = await lista(r)
    expect(l.ordine).not.toContain('carla')
    expect(l.fissi).toEqual({ carla: '2026-11-17' })
    expect(l.ritardi).toEqual({ carla: 1 })
    await assertSucceeds(annulla())
    l = await lista(r)
    expect(l.ordine).toContain('carla')
    expect(l.fissi).toEqual({})
    expect(l.ritardi).toEqual({})
  })
  it('senza storico non passa', async () => {
    const { r, ordine } = await listaPronta()
    const d = dbDi(env, carla)
    await assertFails(
      updateDoc(rifLista(d, r.classId, r.subjectId, r.interrogazioneId), {
        ordine: ordine.filter((x) => x !== 'carla'),
        fissi: { carla: '2026-11-17' },
        aggiornato: serverTimestamp(),
        aggiornatoDa: 'carla',
      }),
    )
  })
  it('il termine lo decide solo il capoclasse, tra 0 e 30 giorni', async () => {
    const { r } = await listaPronta()
    await assertSucceeds(impostaGiorniAssenza(dbDi(env, anna), r.classId, 3))
    await assertSucceeds(impostaGiorniAssenza(dbDi(env, anna), r.classId, 0))
    await assertFails(impostaGiorniAssenza(dbDi(env, anna), r.classId, 31))
    await assertFails(impostaGiorniAssenza(dbDi(env, anna), r.classId, 1.5))
    await assertFails(impostaGiorniAssenza(dbDi(env, bruno), r.classId, 5))
    await assertFails(impostaGiorniAssenza(dbDi(env, carla), r.classId, 5))
  })
})

describe('esclusi prima della generazione', () => {
  it('capo e vice escludono; gli esclusi non scelgono e non entrano in lista', async () => {
    const { classId, codice } = await creaClasse(dbDi(env, anna), anna, '4ªB', () => 'AAAAAA')
    for (const p of [bruno, carla, rossi]) await uniscitiConCodice(dbDi(env, p), p, codice)
    await impostaVice(dbDi(env, anna), classId, 'bruno', true)
    await impostaPermessoDocente(dbDi(env, anna), classId, 'rossi', true)
    const subjectId = await creaMateria(dbDi(env, anna), classId, { nome: 'Storia', orario: [1] })
    const interrogazioneId = await creaInterrogazione(dbDi(env, anna), classId, subjectId, {
      nome: 'Orale', descrizione: '', giorni: [1], perLezione: 1, scadenzaPreferenze: new Date(Date.now() + 3_600_000),
    }, 'anna')
    const r = { classId, subjectId, interrogazioneId }
    await assertFails(impostaEsclusi(dbDi(env, carla), classId, subjectId, interrogazioneId, ['carla']))
    await assertFails(impostaEsclusi(dbDi(env, rossi), classId, subjectId, interrogazioneId, ['carla']))
    await assertSucceeds(impostaEsclusi(dbDi(env, bruno), classId, subjectId, interrogazioneId, ['carla']))
    await assertFails(salvaPreferenza(dbDi(env, carla), r, 'carla', 'inizio'))
    await assertSucceeds(salvaPreferenza(dbDi(env, anna), r, 'anna', 'inizio'))
    await assertFails(
      updateDoc(rifInterrogazione(dbDi(env, anna), classId, subjectId, interrogazioneId), { esclusi: 'carla', aggiornato: serverTimestamp() }),
    )
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(rifInterrogazione(ctx.firestore() as unknown as Firestore, classId, subjectId, interrogazioneId), {
        scadenzaPreferenze: Timestamp.fromDate(new Date(Date.now() - 60_000)),
      })
    })
    const { ordine } = await generaEPubblicaLista(dbDi(env, anna), r, 'anna', 1)
    expect([...ordine].sort()).toEqual(['anna', 'bruno'])
    // dopo, il capo la rimette in fondo
    await assertSucceeds(gestisciImprevisto(dbDi(env, anna), r, { tipo: 'aggiungi', uid: 'carla' }, 'anna'))
    expect((await lista(r)).ordine.at(-1)).toBe('carla')
  })
})

describe('senza lista ("Usa lista" spento)', () => {
  async function classe() {
    const { classId, codice } = await creaClasse(dbDi(env, anna), anna, '4ªB', () => 'AAAAAA')
    for (const p of [bruno, carla, rossi]) await uniscitiConCodice(dbDi(env, p), p, codice)
    const subjectId = await creaMateria(dbDi(env, anna), classId, { nome: 'Storia', orario: [1] })
    return { classId, subjectId }
  }
  const DATI = { nome: 'Orale', descrizione: '', giorni: [1], perLezione: 3, scadenzaPreferenze: new Date(), senzaLista: true }

  it('capo e vice la creano: già in corso, tutti in elenco alfabetico (senza docenti), senza numero per lezione', async () => {
    const { classId, subjectId } = await classe()
    const id = await assertSucceeds(creaSenzaLista(dbDi(env, anna), classId, subjectId, DATI, 'anna'))
    const r = { classId, subjectId, interrogazioneId: id }
    expect(await stato(r)).toBe('lista')
    const i = (await getDoc(rifInterrogazione(dbDi(env, carla), classId, subjectId, id))).data()!
    expect(i).toMatchObject({ senzaLista: true, perLezione: null })
    expect((await lista(r)).ordine).toEqual(['anna', 'bruno', 'carla'])
    await assertSucceeds(segnaInterrogati(dbDi(env, anna), r, ['bruno'], '2026-11-03', 'anna'))
    await assertSucceeds(segnalaInterrogato(dbDi(env, carla), r, 'carla', '2026-11-03'))
  })

  it('studenti e docenti no; e una interrogazione normale non può nascere "in corso"', async () => {
    const { classId, subjectId } = await classe()
    await assertFails(creaSenzaLista(dbDi(env, carla), classId, subjectId, DATI, 'carla'))
    await assertFails(creaSenzaLista(dbDi(env, rossi), classId, subjectId, DATI, 'rossi'))
    const db = dbDi(env, anna)
    const rif = doc(rifInterrogazioni(db, classId, subjectId))
    await assertFails(
      setDoc(rif, {
        nome: 'X', descrizione: '', giorni: [1], perLezione: 1, scadenzaPreferenze: Timestamp.now(),
        stato: 'lista', creato: serverTimestamp(), creatoDa: 'anna', aggiornato: serverTimestamp(),
      }),
    )
  })
})

describe('Notification Box', () => {
  const NOTIFICA = { titolo: 't', testo: 'x', link: '/', letta: false }
  const rif = (p: { uid: string; email: string }, di: string) => doc(dbDi(env, p), 'users', di, 'notifiche', 'n1')
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore() as unknown as Firestore, 'users', 'carla', 'notifiche', 'n1'), NOTIFICA)
    })
  })
  it('ognuno vede solo le proprie, le segna come lette o le cancella', async () => {
    await assertSucceeds(getDoc(rif(carla, 'carla')))
    await assertFails(getDoc(rif(bruno, 'carla')))
    await assertSucceeds(updateDoc(rif(carla, 'carla'), { letta: true }))
    await assertFails(updateDoc(rif(bruno, 'carla'), { letta: true }))
    await assertSucceeds(deleteDoc(rif(carla, 'carla')))
  })
  it('non si cambia il contenuto e non se ne creano di finte', async () => {
    await assertFails(updateDoc(rif(carla, 'carla'), { titolo: 'finta' }))
    await assertFails(updateDoc(rif(carla, 'carla'), { letta: 'sì' }))
    await assertFails(setDoc(doc(dbDi(env, carla), 'users', 'carla', 'notifiche', 'n2'), NOTIFICA))
    await assertFails(setDoc(doc(dbDi(env, anna), 'users', 'carla', 'notifiche', 'n2'), NOTIFICA))
  })
})
