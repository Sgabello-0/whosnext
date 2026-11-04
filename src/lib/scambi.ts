/**
 * Scambi di posizione nella lista. Chi chiede ("da", in posizione daPos) vuole la posizione aPos:
 * decide chi la occupa adesso (la richiesta segue la posizione). Le regole del database controllano
 * che accettando cambino solo quelle due posizioni.
 */
import { serverTimestamp, setDoc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { ErroreApp, rifMembro } from './classi'
import { rifLista, rifScambio } from './configurazione'
import { aggiungiVoceStorico } from './storico'
import type { DocScambio } from './tipi'

type Rif = { classId: string; subjectId: string; interrogazioneId: string }
type Lista = { ordine: string[]; interrogati: Record<string, string> }

export type Scambio = DocScambio & { id: string }

/** Richieste aperte al massimo per persona (sono 3 "posti" fissi: uid_0, uid_1, uid_2). */
export const MAX_RICHIESTE = 3

export function idScambio(uid: string, posto: number): string {
  return `${uid}_${posto}`
}

/**
 * Se una richiesta in attesa si può ancora accettare:
 * "superata" se chi l'ha chiesta non è più nella sua posizione, "interrogato" se uno dei due lo è già.
 */
export function validita(s: DocScambio, lista: Lista): 'valida' | 'superata' | 'interrogato' {
  const destinatario = lista.ordine[s.aPos]
  if (lista.ordine[s.daPos] !== s.da || destinatario === undefined || destinatario === s.da) return 'superata'
  if (lista.interrogati[s.da] || lista.interrogati[destinatario]) return 'interrogato'
  return 'valida'
}

/** Chi deve rispondere adesso (chi occupa la posizione richiesta). */
export function destinatario(s: DocScambio, ordine: string[]): string | undefined {
  return ordine[s.aPos]
}

export function scambiaPosizioni(ordine: string[], i: number, j: number): string[] {
  const nuovo = [...ordine]
  ;[nuovo[i], nuovo[j]] = [nuovo[j]!, nuovo[i]!]
  return nuovo
}

/**
 * Il posto in cui scrivere una nuova richiesta: uno libero (mai usato o chiuso),
 * altrimenti uno con una richiesta in attesa non più valida (da annullare prima). null se sono tutte valide.
 */
export function postoPerNuovaRichiesta(
  mie: Scambio[],
  uid: string,
  lista: Lista,
): { posto: number; daAnnullare: string | null } | null {
  for (let posto = 0; posto < MAX_RICHIESTE; posto++) {
    const s = mie.find((x) => x.id === idScambio(uid, posto))
    if (!s || s.stato !== 'attesa') return { posto, daAnnullare: null }
  }
  for (let posto = 0; posto < MAX_RICHIESTE; posto++) {
    const s = mie.find((x) => x.id === idScambio(uid, posto))
    if (s && validita(s, lista) !== 'valida') return { posto, daAnnullare: s.id }
  }
  return null
}

/** Ho già una richiesta valida in attesa per quella posizione? */
export function richiestaInAttesa(mie: Scambio[], aPos: number, lista: Lista): Scambio | undefined {
  return mie.find((s) => s.stato === 'attesa' && s.aPos === aPos && validita(s, lista) === 'valida')
}

function rif(db: Firestore, r: Rif, id: string) {
  return rifScambio(db, r.classId, r.subjectId, r.interrogazioneId, id)
}

export async function chiediScambio(db: Firestore, r: Rif, uid: string, lista: Lista, aPos: number, mie: Scambio[]): Promise<string> {
  const daPos = lista.ordine.indexOf(uid)
  if (daPos < 0 || daPos === aPos) throw new ErroreApp('dati-non-validi', 'Non sei in questa lista.')
  const scelta = postoPerNuovaRichiesta(mie, uid, lista)
  if (!scelta) {
    throw new ErroreApp('troppe-richieste', `Hai già ${MAX_RICHIESTE} richieste in attesa: annullane una per chiederne un'altra.`)
  }
  if (scelta.daAnnullare) await annullaScambio(db, r, scelta.daAnnullare)
  const id = idScambio(uid, scelta.posto)
  await setDoc(rif(db, r, id), {
    da: uid,
    daPos,
    aPos,
    stato: 'attesa',
    creato: serverTimestamp(),
    aggiornato: serverTimestamp(),
    a: null,
  })
  return id
}

export function annullaScambio(db: Firestore, r: Rif, id: string): Promise<void> {
  return updateDoc(rif(db, r, id), { stato: 'annullato', aggiornato: serverTimestamp() })
}

export function rifiutaScambio(db: Firestore, r: Rif, id: string, uid: string): Promise<void> {
  return updateDoc(rif(db, r, id), { stato: 'rifiutato', a: uid, aggiornato: serverTimestamp() })
}

/** Accetta: nello stesso batch le due posizioni si scambiano e resta una voce nello storico. */
export async function accettaScambio(db: Firestore, r: Rif, s: Scambio, uid: string, lista: Lista): Promise<void> {
  if (validita(s, lista) !== 'valida' || destinatario(s, lista.ordine) !== uid) {
    throw new ErroreApp('dati-non-validi', 'La lista è cambiata: questo scambio non è più possibile.')
  }
  const batch = writeBatch(db)
  const voce = aggiungiVoceStorico(db, batch, r, uid, 'scambio', {
    uids: [s.da, uid],
    posizioni: [s.daPos + 1, s.aPos + 1],
  })
  batch.update(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), {
    ordine: scambiaPosizioni(lista.ordine, s.daPos, s.aPos),
    scambio: s.id,
    ultimaModifica: voce,
    aggiornato: serverTimestamp(),
    aggiornatoDa: uid,
  })
  batch.update(rif(db, r, s.id), { stato: 'accettato', a: uid, aggiornato: serverTimestamp() })
  await batch.commit()
}

/** "Rifiuta in automatico": l'impostazione e, accendendola, il rifiuto delle richieste già arrivate. */
export async function impostaRifiutaScambi(
  db: Firestore,
  classId: string,
  uid: string,
  rifiuta: boolean,
  inArrivo: { r: Rif; id: string }[] = [],
): Promise<void> {
  const batch = writeBatch(db)
  batch.update(rifMembro(db, classId, uid), { rifiutaScambi: rifiuta })
  if (rifiuta) {
    for (const x of inArrivo) {
      batch.update(rif(db, x.r, x.id), { stato: 'rifiutato', a: uid, aggiornato: serverTimestamp() })
    }
  }
  await batch.commit()
}
