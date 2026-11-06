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
import { dataValida } from './calendar'
import { ErroreApp, rifDSA, rifMembri } from './classi'
import { rifInterrogazione, rifLista, rifPreferenza, rifPreferenze, rifRapporto } from './configurazione'
import { generaLista, preferenzeDa, semeCasuale, type Risultato, type Scelta } from './generateList'
import { aggiungiVoceStorico } from './storico'
import type { DocPreferenza, Interrogazione, Membro } from './tipi'

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

export async function salvaPreferenza(
  db: Firestore,
  r: Rif,
  uid: string,
  scelta: Scelta,
  dataDSA: string | null = null,
): Promise<void> {
  if (scelta === 'data' && (dataDSA === null || !dataValida(dataDSA))) {
    throw new ErroreApp('dati-non-validi', 'Scegli la data.')
  }
  await setDoc(rifPreferenza(db, r.classId, r.subjectId, r.interrogazioneId, uid), {
    scelta,
    dataDSA: scelta === 'data' ? dataDSA : null,
    aggiornato: serverTimestamp(),
  })
}

export async function togliPreferenza(db: Firestore, r: Rif, uid: string): Promise<void> {
  await deleteDoc(rifPreferenza(db, r.classId, r.subjectId, r.interrogazioneId, uid))
}

export { preferenzeDa }

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
  const voce = aggiungiVoceStorico(db, batch, r, mioUid, 'generata', { seme })
  batch.set(rifLista(db, r.classId, r.subjectId, r.interrogazioneId), {
    ordine: risultato.ordine,
    fissi: risultato.fissi,
    interrogati: {},
    generata: serverTimestamp(),
    generataDa: mioUid,
    ultimaModifica: voce,
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
