/**
 * Operazioni su classi, membri, codici d'invito e badge DSA.
 * Ogni funzione riceve il database come parametro, così si può provare con l'emulatore.
 * I controlli veri sono in firestore.rules: qui si preparano solo le scritture giuste.
 */
import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { generaCodice } from './codici'
import { IMPOSTAZIONI_DEFAULT, type Invito, type Profilo } from './tipi'

export class ErroreApp extends Error {
  constructor(
    public codice: 'nome-non-valido' | 'codice-inesistente' | 'codice-non-disponibile' | 'solo-studenti' | 'dati-non-validi' | 'troppe-richieste',
    messaggio: string,
  ) {
    super(messaggio)
    this.name = 'ErroreApp'
  }
}

const TENTATIVI_CODICE = 5

// ───────────── Riferimenti ─────────────

export const rifClasse = (db: Firestore, classId: string) => doc(db, 'classes', classId)
export const rifMembri = (db: Firestore, classId: string) => collection(db, 'classes', classId, 'members')
export const rifMembro = (db: Firestore, classId: string, uid: string) => doc(db, 'classes', classId, 'members', uid)
export const rifDSA = (db: Firestore, classId: string) => collection(db, 'classes', classId, 'dsa')
export const rifDSAMembro = (db: Firestore, classId: string, uid: string) => doc(db, 'classes', classId, 'dsa', uid)
export const rifInvito = (db: Firestore, codice: string) => doc(db, 'invites', codice)
export const rifUtente = (db: Firestore, uid: string) => doc(db, 'users', uid)

/** Query di tutte le iscrizioni dell'utente (un documento "members" per ogni classe). */
export const queryMieIscrizioni = (db: Firestore, uid: string) =>
  query(collectionGroup(db, 'members'), where('uid', '==', uid))

// ───────────── Utente ─────────────

/** Crea il documento utente al primo accesso, oppure aggiorna nome e foto. */
export async function salvaProfiloUtente(db: Firestore, p: Profilo): Promise<void> {
  const rif = rifUtente(db, p.uid)
  const esistente = await getDoc(rif)
  if (esistente.exists()) {
    await updateDoc(rif, { nome: p.nome, email: p.email, foto: p.foto, tipo: p.tipo, aggiornato: serverTimestamp() })
  } else {
    await setDoc(rif, {
      nome: p.nome,
      email: p.email,
      foto: p.foto,
      tipo: p.tipo,
      impostazioni: IMPOSTAZIONI_DEFAULT,
      creato: serverTimestamp(),
      aggiornato: serverTimestamp(),
    })
  }
}

// ───────────── Classi ─────────────

function pulisciNomeClasse(nome: string): string {
  const pulito = nome.trim().replace(/\s+/g, ' ')
  if (pulito.length < 1 || pulito.length > 60) {
    throw new ErroreApp('nome-non-valido', 'Il nome della classe deve avere da 1 a 60 caratteri.')
  }
  return pulito
}

/** Cerca un codice d'invito non ancora usato. */
async function codiceLibero(db: Firestore, genera: () => string): Promise<string> {
  for (let i = 0; i < TENTATIVI_CODICE; i++) {
    const codice = genera()
    if (!(await getDoc(rifInvito(db, codice))).exists()) return codice
  }
  throw new ErroreApp('codice-non-disponibile', 'Non è stato possibile generare un codice d\'invito. Riprova.')
}

/** Crea una classe: chi la crea diventa capoclasse. Solo per gli studenti. */
export async function creaClasse(
  db: Firestore,
  p: Profilo,
  nome: string,
  genera: () => string = () => generaCodice(),
): Promise<{ classId: string; codice: string }> {
  if (p.tipo !== 'studente') {
    throw new ErroreApp('solo-studenti', 'Solo gli studenti possono creare una classe.')
  }
  const nomeClasse = pulisciNomeClasse(nome)
  const codice = await codiceLibero(db, genera)
  const classe = doc(collection(db, 'classes'))

  const batch = writeBatch(db)
  batch.set(classe, { nome: nomeClasse, codiceInvito: codice, capoclasseUid: p.uid, creato: serverTimestamp() })
  batch.set(rifMembro(db, classe.id, p.uid), {
    uid: p.uid,
    nome: p.nome,
    email: p.email,
    foto: p.foto,
    ruolo: 'capo',
    permessoModifica: false,
    richiestaPermesso: false,
    codiceUsato: codice,
    entrato: serverTimestamp(),
  })
  batch.set(rifInvito(db, codice), { classId: classe.id, nomeClasse } satisfies Invito)
  await batch.commit()
  return { classId: classe.id, codice }
}

/** Legge un codice d'invito, o null se non esiste. */
export async function leggiInvito(db: Firestore, codice: string): Promise<Invito | null> {
  const snap = await getDoc(rifInvito(db, codice))
  return snap.exists() ? (snap.data() as Invito) : null
}

/** true se l'utente è già membro della classe. */
export async function giaMembro(db: Firestore, classId: string, uid: string): Promise<boolean> {
  return (await getDoc(rifMembro(db, classId, uid))).exists()
}

/**
 * Entra in una classe con il codice d'invito.
 * Gli studenti entrano come "studente", i docenti come "docente" (lo verificano anche le regole).
 */
export async function uniscitiConCodice(db: Firestore, p: Profilo, codice: string): Promise<{ classId: string }> {
  const invito = await leggiInvito(db, codice)
  if (!invito) throw new ErroreApp('codice-inesistente', 'Questo codice d\'invito non esiste o è stato cambiato.')
  if (await giaMembro(db, invito.classId, p.uid)) return { classId: invito.classId }

  await setDoc(rifMembro(db, invito.classId, p.uid), {
    uid: p.uid,
    nome: p.nome,
    email: p.email,
    foto: p.foto,
    ruolo: p.tipo,
    permessoModifica: false,
    richiestaPermesso: false,
    codiceUsato: codice,
    entrato: serverTimestamp(),
  })
  return { classId: invito.classId }
}

/** Il capoclasse rinomina la classe (aggiorna anche il nome mostrato con il codice d'invito). */
export async function rinominaClasse(db: Firestore, classId: string, codiceAttuale: string, nome: string): Promise<void> {
  const nomeClasse = pulisciNomeClasse(nome)
  const batch = writeBatch(db)
  batch.update(rifClasse(db, classId), { nome: nomeClasse })
  batch.update(rifInvito(db, codiceAttuale), { nomeClasse })
  await batch.commit()
}

/** Il capoclasse sostituisce il codice d'invito: quello vecchio smette di funzionare. */
export async function cambiaCodiceInvito(
  db: Firestore,
  classId: string,
  nomeClasse: string,
  codiceVecchio: string,
  genera: () => string = () => generaCodice(),
): Promise<string> {
  const codice = await codiceLibero(db, genera)
  const batch = writeBatch(db)
  batch.update(rifClasse(db, classId), { codiceInvito: codice })
  batch.set(rifInvito(db, codice), { classId, nomeClasse } satisfies Invito)
  batch.delete(rifInvito(db, codiceVecchio))
  await batch.commit()
  return codice
}

// ───────────── Membri ─────────────

/**
 * Toglie un membro dalla classe insieme al suo eventuale badge DSA.
 * Lo usa il capoclasse per rimuovere qualcuno, oppure chiunque (tranne il capo) per uscire.
 */
export async function rimuoviMembro(db: Firestore, classId: string, uid: string): Promise<void> {
  const batch = writeBatch(db)
  batch.delete(rifDSAMembro(db, classId, uid))
  batch.delete(rifMembro(db, classId, uid))
  await batch.commit()
}

/** Il capoclasse nomina o toglie un vice. */
export async function impostaVice(db: Firestore, classId: string, uid: string, vice: boolean): Promise<void> {
  await updateDoc(rifMembro(db, classId, uid), { ruolo: vice ? 'vice' : 'studente' })
}

/** Capo o vice danno o tolgono il badge DSA/BES. */
export async function impostaDSA(db: Firestore, classId: string, uid: string, attivo: boolean, mioUid: string): Promise<void> {
  if (attivo) {
    await setDoc(rifDSAMembro(db, classId, uid), { impostatoDa: mioUid, quando: serverTimestamp() })
  } else {
    await deleteDoc(rifDSAMembro(db, classId, uid))
  }
}

/** Un docente chiede (o ritira la richiesta di) permesso di modifica. */
export async function richiediPermesso(db: Firestore, classId: string, uid: string, richiesta: boolean): Promise<void> {
  await updateDoc(rifMembro(db, classId, uid), { richiestaPermesso: richiesta })
}

/** Il capoclasse concede o toglie il permesso di modifica a un docente. */
export async function impostaPermessoDocente(db: Firestore, classId: string, uid: string, concedi: boolean): Promise<void> {
  await updateDoc(rifMembro(db, classId, uid), { permessoModifica: concedi, richiestaPermesso: false })
}

/**
 * Il capoclasse cede il ruolo a uno studente o al vice; lui resta vice (o torna studente).
 * Tutto in un'unica operazione: non ci sono mai due capoclasse.
 */
export async function cediRuolo(db: Firestore, classId: string, mioUid: string, nuovoUid: string, restaVice: boolean): Promise<void> {
  if (nuovoUid === mioUid) throw new ErroreApp('dati-non-validi', 'Scegli un altro compagno.')
  const batch = writeBatch(db)
  batch.update(rifClasse(db, classId), { capoclasseUid: nuovoUid })
  batch.update(rifMembro(db, classId, nuovoUid), { ruolo: 'capo' })
  batch.update(rifMembro(db, classId, mioUid), { ruolo: restaVice ? 'vice' : 'studente' })
  await batch.commit()
}
