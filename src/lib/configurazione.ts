/**
 * Calendario, materie e interrogazioni di una classe (li configurano capoclasse e vice).
 * Come in classi.ts, ogni funzione riceve il database: si prova con l'emulatore.
 */
import {
  addDoc,
  collection,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentReference,
  type Firestore,
} from 'firebase/firestore'
import { erroreCalendario, GIORNI_LEZIONE, type Calendario } from './calendar'
import { ErroreApp } from './classi'

export const rifCalendario = (db: Firestore, classId: string) => doc(db, 'classes', classId, 'calendar', 'settings')
export const rifMaterie = (db: Firestore, classId: string) => collection(db, 'classes', classId, 'subjects')
export const rifMateria = (db: Firestore, classId: string, subjectId: string) =>
  doc(db, 'classes', classId, 'subjects', subjectId)
export const rifInterrogazioni = (db: Firestore, classId: string, subjectId: string) =>
  collection(db, 'classes', classId, 'subjects', subjectId, 'interrogations')
export const rifInterrogazione = (db: Firestore, classId: string, subjectId: string, interrogazioneId: string) =>
  doc(db, 'classes', classId, 'subjects', subjectId, 'interrogations', interrogazioneId)

export const rifPreferenze = (db: Firestore, classId: string, subjectId: string, interrogazioneId: string) =>
  collection(db, 'classes', classId, 'subjects', subjectId, 'interrogations', interrogazioneId, 'preferences')
export const rifPreferenza = (db: Firestore, classId: string, subjectId: string, interrogazioneId: string, uid: string) =>
  doc(db, 'classes', classId, 'subjects', subjectId, 'interrogations', interrogazioneId, 'preferences', uid)
export const rifLista = (db: Firestore, classId: string, subjectId: string, interrogazioneId: string) =>
  doc(db, 'classes', classId, 'subjects', subjectId, 'interrogations', interrogazioneId, 'list', 'current')
export const rifSegnalazioni = (db: Firestore, classId: string, subjectId: string, interrogazioneId: string) =>
  collection(db, 'classes', classId, 'subjects', subjectId, 'interrogations', interrogazioneId, 'segnalazioni')
export const rifSegnalazione = (db: Firestore, classId: string, subjectId: string, interrogazioneId: string, uid: string) =>
  doc(db, 'classes', classId, 'subjects', subjectId, 'interrogations', interrogazioneId, 'segnalazioni', uid)
export const rifRapporto = (db: Firestore, classId: string, subjectId: string, interrogazioneId: string) =>
  doc(db, 'classes', classId, 'subjects', subjectId, 'interrogations', interrogazioneId, 'list', 'rapporto')

/**
 * Tutti i documenti di un'interrogazione (lei compresa), da cancellare insieme.
 * Lo usano capoclasse e vice, che possono leggere tutte le preferenze.
 */
export async function documentiInterrogazione(
  db: Firestore,
  classId: string,
  subjectId: string,
  interrogazioneId: string,
): Promise<DocumentReference[]> {
  const [preferenze, segnalazioni] = await Promise.all([
    getDocs(rifPreferenze(db, classId, subjectId, interrogazioneId)),
    getDocs(rifSegnalazioni(db, classId, subjectId, interrogazioneId)),
  ])
  return [
    ...preferenze.docs.map((d) => d.ref),
    ...segnalazioni.docs.map((d) => d.ref),
    rifLista(db, classId, subjectId, interrogazioneId),
    rifRapporto(db, classId, subjectId, interrogazioneId),
    rifInterrogazione(db, classId, subjectId, interrogazioneId),
  ]
}

/** Tutti i documenti di una materia (interrogazioni e loro contenuto compresi). */
export async function documentiMateria(db: Firestore, classId: string, subjectId: string): Promise<DocumentReference[]> {
  const interrogazioni = await getDocs(rifInterrogazioni(db, classId, subjectId))
  const perInterrogazione = await Promise.all(
    interrogazioni.docs.map((d) => documentiInterrogazione(db, classId, subjectId, d.id)),
  )
  return [...perInterrogazione.flat(), rifMateria(db, classId, subjectId)]
}

async function cancellaTutti(db: Firestore, riferimenti: DocumentReference[]): Promise<void> {
  if (riferimenti.length > 480) datiNonValidi('Troppi dati da eliminare in una volta.')
  const batch = writeBatch(db)
  for (const r of riferimenti) batch.delete(r)
  await batch.commit()
}

function datiNonValidi(messaggio: string): never {
  throw new ErroreApp('dati-non-validi', messaggio)
}

/** Giorni di lezione puliti: solo lun–sab, senza doppioni, in ordine. */
export function pulisciGiorni(giorni: readonly number[]): number[] {
  return [...new Set(giorni)].filter((g) => (GIORNI_LEZIONE as readonly number[]).includes(g)).sort((a, b) => a - b)
}

// ───────────── Calendario ─────────────

export async function salvaCalendario(db: Firestore, classId: string, cal: Calendario): Promise<void> {
  const errore = erroreCalendario(cal)
  if (errore) datiNonValidi(errore)
  await setDoc(rifCalendario(db, classId), {
    giorniScolastici: cal.giorniScolastici.map(Boolean),
    eccezioni: cal.eccezioni,
    fineAnno: cal.fineAnno,
    aggiornato: serverTimestamp(),
  })
}

// ───────────── Materie ─────────────

export type DatiMateria = { nome: string; orario: number[] }

function pulisciMateria(d: DatiMateria): DatiMateria {
  const nome = d.nome.trim().replace(/\s+/g, ' ')
  if (nome.length < 1 || nome.length > 40) datiNonValidi('Il nome della materia deve avere da 1 a 40 caratteri.')
  return { nome, orario: pulisciGiorni(d.orario) }
}

export async function creaMateria(db: Firestore, classId: string, d: DatiMateria): Promise<string> {
  const rif = await addDoc(rifMaterie(db, classId), { ...pulisciMateria(d), creato: serverTimestamp() })
  return rif.id
}

export async function aggiornaMateria(db: Firestore, classId: string, subjectId: string, d: DatiMateria): Promise<void> {
  await updateDoc(rifMateria(db, classId, subjectId), pulisciMateria(d))
}

/** Elimina la materia con le sue interrogazioni, preferenze e liste. */
export async function eliminaMateria(db: Firestore, classId: string, subjectId: string): Promise<void> {
  await cancellaTutti(db, await documentiMateria(db, classId, subjectId))
}

// ───────────── Interrogazioni ─────────────

export type DatiInterrogazione = {
  nome: string
  descrizione: string
  giorni: number[]
  perLezione: number | null
  scadenzaPreferenze: Date
}

/** Controlla e pulisce i dati del modulo. Messaggio d'errore comprensibile se qualcosa non va. */
export function pulisciInterrogazione(d: DatiInterrogazione): DatiInterrogazione {
  const nome = d.nome.trim().replace(/\s+/g, ' ')
  if (nome.length < 1 || nome.length > 60) datiNonValidi("Il nome dell'interrogazione deve avere da 1 a 60 caratteri.")
  const descrizione = d.descrizione.trim()
  if (descrizione.length > 500) datiNonValidi('La descrizione può avere al massimo 500 caratteri.')
  if (d.perLezione !== null && (!Number.isInteger(d.perLezione) || d.perLezione < 1 || d.perLezione > 50)) {
    datiNonValidi('Il numero di interrogati per lezione deve essere tra 1 e 50 (oppure lascialo vuoto).')
  }
  if (!(d.scadenzaPreferenze instanceof Date) || Number.isNaN(d.scadenzaPreferenze.getTime())) {
    datiNonValidi('Indica la scadenza per le preferenze.')
  }
  return { nome, descrizione, giorni: pulisciGiorni(d.giorni), perLezione: d.perLezione, scadenzaPreferenze: d.scadenzaPreferenze }
}

export async function creaInterrogazione(
  db: Firestore,
  classId: string,
  subjectId: string,
  d: DatiInterrogazione,
  mioUid: string,
  adesso: Date = new Date(),
): Promise<string> {
  const p = pulisciInterrogazione(d)
  if (p.scadenzaPreferenze <= adesso) datiNonValidi('La scadenza per le preferenze deve essere nel futuro.')
  const rif = await addDoc(rifInterrogazioni(db, classId, subjectId), {
    ...p,
    scadenzaPreferenze: Timestamp.fromDate(p.scadenzaPreferenze),
    stato: 'raccolta',
    creato: serverTimestamp(),
    creatoDa: mioUid,
    aggiornato: serverTimestamp(),
  })
  return rif.id
}

export async function aggiornaInterrogazione(
  db: Firestore,
  classId: string,
  subjectId: string,
  interrogazioneId: string,
  d: DatiInterrogazione,
): Promise<void> {
  const p = pulisciInterrogazione(d)
  await updateDoc(rifInterrogazione(db, classId, subjectId, interrogazioneId), {
    ...p,
    scadenzaPreferenze: Timestamp.fromDate(p.scadenzaPreferenze),
    aggiornato: serverTimestamp(),
  })
}

/** Elimina l'interrogazione con preferenze e lista. */
export async function eliminaInterrogazione(
  db: Firestore,
  classId: string,
  subjectId: string,
  interrogazioneId: string,
): Promise<void> {
  await cancellaTutti(db, await documentiInterrogazione(db, classId, subjectId, interrogazioneId))
}
