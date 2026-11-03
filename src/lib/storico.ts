import { doc, serverTimestamp, type DocumentReference, type Firestore, type WriteBatch } from 'firebase/firestore'
import { rifStorico } from './configurazione'
import type { DocStorico } from './tipi'

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

/**
 * Aggiunge al batch una voce di storico e restituisce il suo id,
 * da scrivere come `ultimaModifica` nella lista (le regole lo pretendono).
 */
export function aggiungiVoceStorico(
  db: Firestore,
  batch: WriteBatch,
  r: Rif,
  chi: string,
  tipo: DocStorico['tipo'],
  dettagli: DocStorico['dettagli'],
): string {
  const voce: DocumentReference = doc(rifStorico(db, r.classId, r.subjectId, r.interrogazioneId))
  batch.set(voce, { tipo, chi, quando: serverTimestamp(), dettagli })
  return voce.id
}
