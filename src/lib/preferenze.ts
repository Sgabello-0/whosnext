/**
 * Preferenze degli studenti e generazione della lista (fatta dal capoclasse o dal vice
 * dopo la scadenza; più avanti la farà da sola una funzione sul server).
 */
import {
  deleteDoc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { ErroreApp, rifDSA, rifMembri } from './classi'
import { rifInterrogazione, rifLista, rifPreferenza, rifPreferenze, rifRapporto } from './configurazione'
import { generaLista, semeCasuale, type Preferenza, type Risultato, type Scelta } from './generateList'
import type { DocPreferenza, Interrogazione, Membro } from './tipi'

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

export async function salvaPreferenza(
  db: Firestore,
  r: Rif,
  uid: string,
  scelta: Scelta,
  posizioneDSA: number | null = null,
): Promise<void> {
  if (scelta === 'posizione' && (posizioneDSA === null || !Number.isInteger(posizioneDSA) || posizioneDSA < 1)) {
    throw new ErroreApp('dati-non-validi', 'Scegli la posizione.')
  }
  await setDoc(rifPreferenza(db, r.classId, r.subjectId, r.interrogazioneId, uid), {
    scelta,
    posizioneDSA: scelta === 'posizione' ? posizioneDSA : null,
    aggiornato: serverTimestamp(),
  })
}

export async function togliPreferenza(db: Firestore, r: Rif, uid: string): Promise<void> {
  await deleteDoc(rifPreferenza(db, r.classId, r.subjectId, r.interrogazioneId, uid))
}

/** Converte i documenti delle preferenze nel formato dell'algoritmo. */
export function preferenzeDa(documenti: { id: string; dati: DocPreferenza }[]): Map<string, Preferenza> {
  return new Map(
    documenti.map(({ id, dati }) => [
      id,
      { scelta: dati.scelta, posizioneDSA: dati.posizioneDSA ?? null, quando: dati.aggiornato?.toMillis() ?? 0 },
    ]),
  )
}

/**
 * Genera la lista e la pubblica: legge studenti, badge DSA e preferenze, calcola l'ordine
 * e salva lista, rapporto e nuovo stato dell'interrogazione in un'unica operazione.
 */
export async function generaEPubblicaLista(
  db: Firestore,
  r: Rif,
  mioUid: string,
  seme: number = semeCasuale(),
  adesso: Date = new Date(),
): Promise<Risultato> {
  const interr = await getDoc(rifInterrogazione(db, r.classId, r.subjectId, r.interrogazioneId))
  const dati = interr.data() as Interrogazione | undefined
  if (!dati) throw new ErroreApp('dati-non-validi', "L'interrogazione non esiste più.")
  if (dati.stato !== 'raccolta') throw new ErroreApp('dati-non-validi', 'La lista è già stata generata.')
  if (dati.scadenzaPreferenze.toDate() > adesso) {
    throw new ErroreApp('dati-non-validi', 'Le preferenze sono ancora aperte: aspetta la scadenza.')
  }

  const [membri, dsa, preferenze] = await Promise.all([
    getDocs(rifMembri(db, r.classId)),
    getDocs(rifDSA(db, r.classId)),
    getDocs(rifPreferenze(db, r.classId, r.subjectId, r.interrogazioneId)),
  ])
  const studenti = membri.docs.map((d) => d.data() as Membro).filter((m) => m.ruolo !== 'docente').map((m) => m.uid)
  const risultato = generaLista({
    studenti,
    preferenze: preferenzeDa(preferenze.docs.map((d) => ({ id: d.id, dati: d.data() as DocPreferenza }))),
    dsa: new Set(dsa.docs.map((d) => d.id)),
    seme,
  })

  const batch = writeBatch(db)
  batch.set(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), {
    ordine: risultato.ordine,
    interrogati: {},
    generata: serverTimestamp(),
    generataDa: mioUid,
  })
  batch.set(rifRapporto(db, r.classId, r.subjectId, r.interrogazioneId), {
    ...risultato.rapporto,
    generata: serverTimestamp(),
  })
  batch.update(rifInterrogazione(db, r.classId, r.subjectId, r.interrogazioneId), {
    stato: 'lista',
    aggiornato: serverTimestamp(),
  })
  await batch.commit()
  return risultato
}
