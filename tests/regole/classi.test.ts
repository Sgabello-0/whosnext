import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  collectionGroup,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore'
import {
  cambiaCodiceInvito,
  creaClasse,
  ErroreApp,
  impostaDSA,
  impostaPermessoDocente,
  impostaVice,
  leggiInvito,
  queryMieIscrizioni,
  richiediPermesso,
  rifClasse,
  rifDSA,
  rifDSAMembro,
  mostraMioDSA,
  rifInvito,
  rifMembri,
  rifMembro,
  rifUtente,
  rimuoviMembro,
  rinominaClasse,
  salvaProfiloUtente,
  uniscitiConCodice,
} from '../../src/lib/classi'
import { avviaAmbiente, dbDi, esterno, UTENTI } from './aiuti'

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

/** Classe "4ªB" creata da Anna (capo), con Bruno e Carla studenti e il prof. Rossi. */
async function classeDiProva() {
  const codici = ['AAAAAA', 'BBBBBB', 'CCCCCC']
  const { classId, codice } = await creaClasse(dbDi(env, anna), anna, '4ªB', () => codici.shift()!)
  await uniscitiConCodice(dbDi(env, bruno), bruno, codice)
  await uniscitiConCodice(dbDi(env, carla), carla, codice)
  await uniscitiConCodice(dbDi(env, rossi), rossi, codice)
  return { classId, codice }
}

/** Dati di un membro come li scriverebbe il sito, con eventuali modifiche "malevole". */
function datiMembro(p: { uid: string; nome: string; email: string }, codice: string, extra: Record<string, unknown> = {}) {
  return {
    uid: p.uid,
    nome: p.nome,
    email: p.email,
    foto: null,
    ruolo: 'studente',
    permessoModifica: false,
    richiestaPermesso: false,
    codiceUsato: codice,
    entrato: serverTimestamp(),
    ...extra,
  }
}

// ───────────────────────────────────────────────────────────

describe('profilo utente', () => {
  it('studenti e docenti salvano il proprio profilo', async () => {
    await assertSucceeds(salvaProfiloUtente(dbDi(env, anna), anna))
    await assertSucceeds(salvaProfiloUtente(dbDi(env, rossi), rossi))
    // secondo accesso: aggiornamento
    await assertSucceeds(salvaProfiloUtente(dbDi(env, anna), { ...anna, nome: 'Anna V.' }))
    const snap = await getDoc(rifUtente(dbDi(env, anna), 'anna'))
    expect(snap.data()?.nome).toBe('Anna V.')
    expect(snap.data()?.impostazioni).toEqual({ autoRifiutaScambi: false, notificheEmail: true, notifichePush: true })
  })

  it('uno studente non può dichiararsi docente e viceversa', async () => {
    await assertFails(salvaProfiloUtente(dbDi(env, anna), { ...anna, tipo: 'docente' }))
    await assertFails(salvaProfiloUtente(dbDi(env, rossi), { ...rossi, tipo: 'studente' }))
  })

  it('account esterni alla scuola o non verificati vengono rifiutati', async () => {
    const gmail = esterno('g', 'mario@gmail.com')
    await assertFails(salvaProfiloUtente(dbDi(env, gmail), gmail))
    const finto = esterno('f', 'mario@studenti.ittsrimini.edu.it.evil.com')
    await assertFails(salvaProfiloUtente(dbDi(env, finto), finto))
    await assertFails(salvaProfiloUtente(dbDi(env, anna, false), anna))
    await assertFails(salvaProfiloUtente(env.unauthenticatedContext().firestore() as never, anna))
  })

  it('non si può scrivere con un\'email diversa da quella dell\'account', async () => {
    await assertFails(salvaProfiloUtente(dbDi(env, anna), { ...anna, email: 'altra@studenti.ittsrimini.edu.it' }))
  })

  it('non si legge né si scrive il profilo di un altro', async () => {
    await salvaProfiloUtente(dbDi(env, anna), anna)
    await assertFails(getDoc(rifUtente(dbDi(env, bruno), 'anna')))
    await assertFails(salvaProfiloUtente(dbDi(env, bruno), { ...anna }))
  })
})

// ───────────────────────────────────────────────────────────

describe('creazione della classe', () => {
  it('uno studente crea una classe e ne diventa capoclasse', async () => {
    const db = dbDi(env, anna)
    const { classId, codice } = await creaClasse(db, anna, '  4ªB   Informatica ', () => 'ABCDEF')
    expect(codice).toBe('ABCDEF')
    const classe = (await getDoc(rifClasse(db, classId))).data()
    expect(classe).toMatchObject({ nome: '4ªB Informatica', codiceInvito: 'ABCDEF', capoclasseUid: 'anna' })
    expect((await getDoc(rifMembro(db, classId, 'anna'))).data()?.ruolo).toBe('capo')
    expect(await leggiInvito(db, 'ABCDEF')).toEqual({ classId, nomeClasse: '4ªB Informatica' })
  })

  it('se il codice è già usato ne genera un altro', async () => {
    await creaClasse(dbDi(env, anna), anna, 'Prima', () => 'ABCDEF')
    const codici = ['ABCDEF', 'GHJKMN']
    const { codice } = await creaClasse(dbDi(env, bruno), bruno, 'Seconda', () => codici.shift()!)
    expect(codice).toBe('GHJKMN')
  })

  it('i docenti non possono creare classi, nemmeno scrivendo direttamente', async () => {
    await expect(creaClasse(dbDi(env, rossi), rossi, '4ªB')).rejects.toBeInstanceOf(ErroreApp)
    // aggirando il controllo del sito
    await assertFails(creaClasse(dbDi(env, rossi), { ...rossi, tipo: 'studente' }, '4ªB'))
  })

  it('nomi vuoti o troppo lunghi vengono rifiutati', async () => {
    await expect(creaClasse(dbDi(env, anna), anna, '   ')).rejects.toMatchObject({ codice: 'nome-non-valido' })
    await expect(creaClasse(dbDi(env, anna), anna, 'x'.repeat(61))).rejects.toMatchObject({ codice: 'nome-non-valido' })
  })

  it('non si crea una classe senza il proprio documento da capo e il codice d\'invito', async () => {
    const db = dbDi(env, anna)
    await assertFails(
      setDoc(doc(db, 'classes', 'x1'), { nome: 'X', codiceInvito: 'ABCDEF', capoclasseUid: 'anna', creato: serverTimestamp() }),
    )
  })

  it('non si può nominare capoclasse qualcun altro', async () => {
    const db = dbDi(env, anna)
    const b = writeBatch(db)
    b.set(doc(db, 'classes', 'x1'), { nome: 'X', codiceInvito: 'ABCDEF', capoclasseUid: 'bruno', creato: serverTimestamp() })
    b.set(doc(db, 'classes', 'x1', 'members', 'anna'), { ...datiMembro(anna, 'ABCDEF'), ruolo: 'capo' })
    b.set(doc(db, 'invites', 'ABCDEF'), { classId: 'x1', nomeClasse: 'X' })
    await assertFails(b.commit())
  })

  it('non ci si fa capo di una classe che esiste già', async () => {
    const { classId, codice } = await classeDiProva()
    const db = dbDi(env, bruno)
    await assertFails(updateDoc(rifMembro(db, classId, 'bruno'), { ruolo: 'capo' }))
    await assertFails(setDoc(rifMembro(dbDi(env, bianchi), classId, 'bianchi'), datiMembro(bianchi, codice, { ruolo: 'capo' })))
  })
})

// ───────────────────────────────────────────────────────────

describe('unirsi a una classe', () => {
  it('studenti entrano come studenti, docenti come docenti', async () => {
    const { classId } = await classeDiProva()
    const db = dbDi(env, anna)
    expect((await getDoc(rifMembro(db, classId, 'bruno'))).data()?.ruolo).toBe('studente')
    expect((await getDoc(rifMembro(db, classId, 'rossi'))).data()?.ruolo).toBe('docente')
  })

  it('unirsi due volte non cambia niente', async () => {
    const { classId, codice } = await classeDiProva()
    await assertSucceeds(uniscitiConCodice(dbDi(env, bruno), bruno, codice))
    expect((await getDocs(rifMembri(dbDi(env, anna), classId))).size).toBe(4)
  })

  it('non ci si unisce con un ruolo diverso dal proprio', async () => {
    const { classId, codice } = await classeDiProva()
    const db = dbDi(env, bianchi)
    await assertFails(setDoc(rifMembro(db, classId, 'bianchi'), datiMembro(bianchi, codice, { ruolo: 'studente' })))
    await assertFails(setDoc(rifMembro(db, classId, 'bianchi'), datiMembro(bianchi, codice, { ruolo: 'vice' })))
    await assertFails(
      setDoc(rifMembro(db, classId, 'bianchi'), datiMembro(bianchi, codice, { ruolo: 'docente', permessoModifica: true })),
    )
    await assertSucceeds(setDoc(rifMembro(db, classId, 'bianchi'), datiMembro(bianchi, codice, { ruolo: 'docente' })))
  })

  it('serve un codice valido per quella classe', async () => {
    const { classId } = await classeDiProva()
    const altra = await creaClasse(dbDi(env, carla), carla, 'Altra', () => 'ZZZZZZ')
    const db = dbDi(env, bianchi)
    await expect(uniscitiConCodice(db, bianchi, 'QQQQQQ')).rejects.toMatchObject({ codice: 'codice-inesistente' })
    // codice di un'altra classe
    await assertFails(setDoc(rifMembro(db, classId, 'bianchi'), datiMembro(bianchi, altra.codice, { ruolo: 'docente' })))
  })

  it('non ci si iscrive al posto di un altro', async () => {
    const { classId, codice } = await classeDiProva()
    await assertFails(setDoc(rifMembro(dbDi(env, bruno), classId, 'bianchi'), datiMembro(bianchi, codice, { ruolo: 'docente' })))
  })

  it('chi non è della scuola non legge i codici e non entra', async () => {
    const { classId, codice } = await classeDiProva()
    const gmail = esterno('g', 'mario@gmail.com')
    const db = dbDi(env, gmail)
    await assertFails(getDoc(rifInvito(db, codice)))
    await assertFails(setDoc(rifMembro(db, classId, 'g'), datiMembro(gmail, codice)))
  })

  it('i codici d\'invito non si possono elencare', async () => {
    await classeDiProva()
    await assertFails(getDocs(collection(dbDi(env, bianchi), 'invites')))
  })
})

// ───────────────────────────────────────────────────────────

describe('lettura', () => {
  it('i membri leggono classe e membri, gli altri no', async () => {
    const { classId } = await classeDiProva()
    await assertSucceeds(getDoc(rifClasse(dbDi(env, rossi), classId)))
    await assertSucceeds(getDocs(rifMembri(dbDi(env, bruno), classId)))
    await assertFails(getDoc(rifClasse(dbDi(env, bianchi), classId)))
    await assertFails(getDocs(rifMembri(dbDi(env, bianchi), classId)))
  })

  it('ognuno vede l\'elenco delle proprie classi, non quello degli altri', async () => {
    const { classId } = await classeDiProva()
    await creaClasse(dbDi(env, bruno), bruno, 'Seconda classe di Bruno', () => 'MMMMMM')
    const mie = await getDocs(queryMieIscrizioni(dbDi(env, bruno), 'bruno'))
    expect(mie.size).toBe(2)
    expect(mie.docs.map((d) => d.ref.parent.parent?.id)).toContain(classId)
    await assertFails(getDocs(query(collectionGroup(dbDi(env, carla), 'members'), where('uid', '==', 'bruno'))))
  })

  it('il proprio documento si legge anche prima di entrare', async () => {
    const { classId } = await classeDiProva()
    const snap = await assertSucceeds(getDoc(rifMembro(dbDi(env, bianchi), classId, 'bianchi')))
    expect(snap.exists()).toBe(false)
    await assertFails(getDoc(rifMembro(dbDi(env, bianchi), classId, 'bruno')))
  })
})

// ───────────────────────────────────────────────────────────

describe('ruoli e permessi', () => {
  it('il capoclasse nomina e toglie il vice', async () => {
    const { classId } = await classeDiProva()
    const db = dbDi(env, anna)
    await assertSucceeds(impostaVice(db, classId, 'bruno', true))
    expect((await getDoc(rifMembro(db, classId, 'bruno'))).data()?.ruolo).toBe('vice')
    await assertSucceeds(impostaVice(db, classId, 'bruno', false))
  })

  it('il vice e gli studenti non nominano vice, nemmeno sé stessi', async () => {
    const { classId } = await classeDiProva()
    await impostaVice(dbDi(env, anna), classId, 'bruno', true)
    await assertFails(impostaVice(dbDi(env, bruno), classId, 'carla', true))
    await assertFails(impostaVice(dbDi(env, carla), classId, 'carla', true))
  })

  it('un docente non può diventare vice, e nessuno diventa capo', async () => {
    const { classId } = await classeDiProva()
    const db = dbDi(env, anna)
    await assertFails(impostaVice(db, classId, 'rossi', true))
    await assertFails(updateDoc(rifMembro(db, classId, 'bruno'), { ruolo: 'capo' }))
    await assertFails(updateDoc(rifMembro(db, classId, 'bruno'), { ruolo: 'docente' }))
  })

  it('il docente chiede il permesso, il capoclasse lo concede e lo revoca', async () => {
    const { classId } = await classeDiProva()
    await assertSucceeds(richiediPermesso(dbDi(env, rossi), classId, 'rossi', true))
    expect((await getDoc(rifMembro(dbDi(env, anna), classId, 'rossi'))).data()?.richiestaPermesso).toBe(true)
    await assertSucceeds(impostaPermessoDocente(dbDi(env, anna), classId, 'rossi', true))
    const dati = (await getDoc(rifMembro(dbDi(env, anna), classId, 'rossi'))).data()
    expect(dati).toMatchObject({ permessoModifica: true, richiestaPermesso: false })
    await assertSucceeds(impostaPermessoDocente(dbDi(env, anna), classId, 'rossi', false))
  })

  it('il docente non si dà il permesso da solo, e il vice non lo concede', async () => {
    const { classId } = await classeDiProva()
    await assertFails(updateDoc(rifMembro(dbDi(env, rossi), classId, 'rossi'), { permessoModifica: true }))
    await impostaVice(dbDi(env, anna), classId, 'bruno', true)
    await assertFails(impostaPermessoDocente(dbDi(env, bruno), classId, 'rossi', true))
  })

  it('gli studenti non possono chiedere il permesso da docente', async () => {
    const { classId } = await classeDiProva()
    await assertFails(richiediPermesso(dbDi(env, bruno), classId, 'bruno', true))
    await assertFails(impostaPermessoDocente(dbDi(env, anna), classId, 'bruno', true))
  })

  it('ognuno cambia il proprio nome, ma non ruolo o email', async () => {
    const { classId } = await classeDiProva()
    const db = dbDi(env, bruno)
    await assertSucceeds(updateDoc(rifMembro(db, classId, 'bruno'), { nome: 'Bruno N.' }))
    await assertFails(updateDoc(rifMembro(db, classId, 'bruno'), { email: 'x@studenti.ittsrimini.edu.it' }))
    await assertFails(updateDoc(rifMembro(db, classId, 'carla'), { nome: 'Carla?' }))
  })
})

// ───────────────────────────────────────────────────────────

describe('uscire e rimuovere', () => {
  it('uno studente esce dalla classe', async () => {
    const { classId } = await classeDiProva()
    await assertSucceeds(rimuoviMembro(dbDi(env, bruno), classId, 'bruno'))
    await assertFails(getDoc(rifClasse(dbDi(env, bruno), classId)))
  })

  it('il capoclasse non può uscire', async () => {
    const { classId } = await classeDiProva()
    await assertFails(rimuoviMembro(dbDi(env, anna), classId, 'anna'))
  })

  it('il capoclasse rimuove gli altri, gli studenti no', async () => {
    const { classId } = await classeDiProva()
    await assertFails(rimuoviMembro(dbDi(env, bruno), classId, 'carla'))
    await impostaVice(dbDi(env, anna), classId, 'bruno', true)
    await assertFails(rimuoviMembro(dbDi(env, bruno), classId, 'carla'))
    await assertSucceeds(rimuoviMembro(dbDi(env, anna), classId, 'carla'))
    await assertSucceeds(rimuoviMembro(dbDi(env, anna), classId, 'rossi'))
  })
})

// ───────────────────────────────────────────────────────────

describe('badge DSA/BES', () => {
  it('capo e vice danno e tolgono il badge', async () => {
    const { classId } = await classeDiProva()
    await assertSucceeds(impostaDSA(dbDi(env, anna), classId, 'carla', true, 'anna'))
    await impostaVice(dbDi(env, anna), classId, 'bruno', true)
    await assertSucceeds(impostaDSA(dbDi(env, bruno), classId, 'carla', false, 'bruno'))
    await assertSucceeds(impostaDSA(dbDi(env, bruno), classId, 'anna', true, 'bruno'))
  })

  it('studenti e docenti (anche con permesso) non danno il badge', async () => {
    const { classId } = await classeDiProva()
    await assertFails(impostaDSA(dbDi(env, carla), classId, 'carla', true, 'carla'))
    await impostaPermessoDocente(dbDi(env, anna), classId, 'rossi', true)
    await assertFails(impostaDSA(dbDi(env, rossi), classId, 'carla', true, 'rossi'))
  })

  it('non si dà il badge a un docente o a chi non è nella classe', async () => {
    const { classId } = await classeDiProva()
    await assertFails(impostaDSA(dbDi(env, anna), classId, 'rossi', true, 'anna'))
    await assertFails(impostaDSA(dbDi(env, anna), classId, 'bianchi', true, 'anna'))
  })

  it('non si può fingere che sia stato un altro a dare il badge', async () => {
    const { classId } = await classeDiProva()
    await assertFails(impostaDSA(dbDi(env, anna), classId, 'carla', true, 'bruno'))
  })

  it('di base è nascosto, e capo e vice non possono farlo nascere visibile', async () => {
    const { classId } = await classeDiProva()
    await impostaDSA(dbDi(env, anna), classId, 'carla', true, 'anna')
    await assertFails(getDoc(rifDSAMembro(dbDi(env, bruno), classId, 'carla')))
    await assertFails(getDoc(rifDSAMembro(dbDi(env, rossi), classId, 'carla')))
    expect((await getDocs(query(rifDSA(dbDi(env, bruno), classId), where('visibile', '==', true)))).size).toBe(0)
    await assertSucceeds(getDoc(rifDSAMembro(dbDi(env, carla), classId, 'carla')))
    await assertSucceeds(getDocs(rifDSA(dbDi(env, anna), classId)))
    await assertFails(
      setDoc(rifDSAMembro(dbDi(env, anna), classId, 'bruno'), { impostatoDa: 'anna', quando: serverTimestamp(), visibile: true }),
    )
  })

  it('se lo studente lo mostra: lo vede tutta la classe (anche i docenti); chi è fuori no', async () => {
    const { classId } = await classeDiProva()
    await impostaDSA(dbDi(env, anna), classId, 'carla', true, 'anna')
    await assertSucceeds(mostraMioDSA(dbDi(env, carla), [classId], 'carla', true))
    await assertSucceeds(getDocs(rifDSA(dbDi(env, anna), classId)))
    await assertSucceeds(getDoc(rifDSAMembro(dbDi(env, carla), classId, 'carla')))
    await assertSucceeds(getDoc(rifDSAMembro(dbDi(env, bruno), classId, 'carla')))
    await assertSucceeds(getDocs(query(rifDSA(dbDi(env, bruno), classId), where('visibile', '==', true))))
    await assertSucceeds(getDoc(rifDSAMembro(dbDi(env, rossi), classId, 'carla')))
    await assertFails(getDoc(rifDSAMembro(dbDi(env, bianchi), classId, 'carla')))
    // senza filtro uno studente non può elencarli tutti (anche quelli nascosti)
    await assertFails(getDocs(rifDSA(dbDi(env, bruno), classId)))
  })

  it('nascosto dal diretto interessato: lo vedono solo capo, vice e lui', async () => {
    const { classId } = await classeDiProva()
    await impostaDSA(dbDi(env, anna), classId, 'carla', true, 'anna')
    await assertSucceeds(mostraMioDSA(dbDi(env, carla), [classId], 'carla', true))
    await assertSucceeds(mostraMioDSA(dbDi(env, carla), [classId], 'carla', false))
    await assertFails(getDoc(rifDSAMembro(dbDi(env, bruno), classId, 'carla')))
    await assertFails(getDoc(rifDSAMembro(dbDi(env, rossi), classId, 'carla')))
    expect((await getDocs(query(rifDSA(dbDi(env, bruno), classId), where('visibile', '==', true)))).size).toBe(0)
    await assertSucceeds(getDoc(rifDSAMembro(dbDi(env, carla), classId, 'carla')))
    await assertSucceeds(getDocs(rifDSA(dbDi(env, anna), classId)))
    await impostaVice(dbDi(env, anna), classId, 'bruno', true)
    await assertSucceeds(getDoc(rifDSAMembro(dbDi(env, bruno), classId, 'carla')))
    // e lo rimostra
    await assertSucceeds(mostraMioDSA(dbDi(env, carla), [classId], 'carla', true))
    await assertSucceeds(getDoc(rifDSAMembro(dbDi(env, rossi), classId, 'carla')))
  })

  it('solo il diretto interessato lo mostra o nasconde, e cambia solo quello', async () => {
    const { classId } = await classeDiProva()
    await impostaDSA(dbDi(env, anna), classId, 'carla', true, 'anna')
    await assertFails(mostraMioDSA(dbDi(env, bruno), [classId], 'carla', false))
    await assertFails(mostraMioDSA(dbDi(env, anna), [classId], 'carla', false))
    const mio = rifDSAMembro(dbDi(env, carla), classId, 'carla')
    await assertFails(updateDoc(mio, { visibile: 'no' }))
    await assertFails(updateDoc(mio, { impostatoDa: 'carla' }))
    await assertFails(updateDoc(mio, { visibile: false, altro: 1 }))
    // un badge che non c'è non si crea così
    await assertFails(mostraMioDSA(dbDi(env, bruno), [classId], 'bruno', true))
    // capo e vice non lo creano con campi strani
    await assertFails(setDoc(rifDSAMembro(dbDi(env, anna), classId, 'bruno'), { impostatoDa: 'anna', quando: serverTimestamp(), visibile: 'sì' }))
  })

  it('lo studente non può togliersi il badge da solo (solo nasconderlo)', async () => {
    const { classId } = await classeDiProva()
    await impostaDSA(dbDi(env, anna), classId, 'carla', true, 'anna')
    await assertFails(deleteDoc(rifDSAMembro(dbDi(env, carla), classId, 'carla')))
    await assertFails(impostaDSA(dbDi(env, carla), classId, 'carla', false, 'carla'))
    // né quello di un compagno
    await assertFails(deleteDoc(rifDSAMembro(dbDi(env, bruno), classId, 'carla')))
    expect((await getDoc(rifDSAMembro(dbDi(env, anna), classId, 'carla'))).exists()).toBe(true)
    await assertSucceeds(mostraMioDSA(dbDi(env, carla), [classId], 'carla', false))
  })

  it('chi esce dalla classe perde anche il badge', async () => {
    const { classId } = await classeDiProva()
    await impostaDSA(dbDi(env, anna), classId, 'carla', true, 'anna')
    await assertSucceeds(rimuoviMembro(dbDi(env, carla), classId, 'carla'))
    expect((await getDoc(rifDSAMembro(dbDi(env, anna), classId, 'carla'))).exists()).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────

describe('codice d\'invito e nome della classe', () => {
  it('il capoclasse cambia il codice e quello vecchio non funziona più', async () => {
    const { classId, codice } = await classeDiProva()
    const nuovo = await assertSucceeds(cambiaCodiceInvito(dbDi(env, anna), classId, '4ªB', codice, () => 'NNNNNN'))
    expect(nuovo).toBe('NNNNNN')
    expect(await leggiInvito(dbDi(env, bianchi), codice)).toBeNull()
    await expect(uniscitiConCodice(dbDi(env, bianchi), bianchi, codice)).rejects.toMatchObject({ codice: 'codice-inesistente' })
    await assertSucceeds(uniscitiConCodice(dbDi(env, bianchi), bianchi, 'NNNNNN'))
  })

  it('cambiando codice bisogna cancellare quello vecchio', async () => {
    const { classId } = await classeDiProva()
    const db = dbDi(env, anna)
    const b = writeBatch(db)
    b.update(rifClasse(db, classId), { codiceInvito: 'NNNNNN' })
    b.set(rifInvito(db, 'NNNNNN'), { classId, nomeClasse: '4ªB' })
    await assertFails(b.commit())
  })

  it('solo il capoclasse cambia codice e nome', async () => {
    const { classId, codice } = await classeDiProva()
    await impostaVice(dbDi(env, anna), classId, 'bruno', true)
    await assertFails(cambiaCodiceInvito(dbDi(env, bruno), classId, '4ªB', codice, () => 'NNNNNN'))
    await assertFails(rinominaClasse(dbDi(env, bruno), classId, codice, 'Hackerata'))
    await assertFails(deleteDoc(rifInvito(dbDi(env, bruno), codice)))
  })

  it('il capoclasse rinomina la classe e il codice mostra il nome nuovo', async () => {
    const { classId, codice } = await classeDiProva()
    await assertSucceeds(rinominaClasse(dbDi(env, anna), classId, codice, '5ªB'))
    expect((await leggiInvito(dbDi(env, bianchi), codice))?.nomeClasse).toBe('5ªB')
  })

  it('il capoclasse non può cambiare il capoclasse con una modifica diretta', async () => {
    const { classId } = await classeDiProva()
    await assertFails(updateDoc(rifClasse(dbDi(env, anna), classId), { capoclasseUid: 'bruno' }))
  })
})
