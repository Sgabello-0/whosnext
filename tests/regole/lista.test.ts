import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, type Firestore } from 'firebase/firestore'
import { creaClasse, impostaPermessoDocente, impostaVice, uniscitiConCodice } from '../../src/lib/classi'
import {
  creaInterrogazione,
  creaMateria,
  eliminaInterrogazione,
  rifInterrogazione,
  rifLista,
  rifSegnalazione,
  rifSegnalazioni,
} from '../../src/lib/configurazione'
import { riordinaLista, segnaInterrogati, segnalaInterrogato, togliInterrogato, togliSegnalazione } from '../../src/lib/gestioneLista'
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

/** Anna capo, Bruno vice, Carla studente, Rossi docente (senza permesso), Bianchi docente con permesso; lista generata. */
async function listaPronta() {
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
    await assertSucceeds(segnaInterrogati(dbDi(env, bianchi), r, ordine.slice(1), '2026-11-10', 'bianchi'))
    expect(await stato(r)).toBe('conclusa')
    // tolto uno, torna "lista"
    await assertSucceeds(togliInterrogato(dbDi(env, bruno), r, ordine[2]!, 'bruno'))
    expect(await stato(r)).toBe('lista')
    expect(Object.keys((await lista(r)).interrogati)).toHaveLength(2)
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
