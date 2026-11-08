/**
 * Preferenze degli studenti e generazione della lista (fatta dal capoclasse o dal vice
 * dopo la scadenza; più avanti la farà da sola una funzione sul server).
 */
import {
  deleteDoc,
  doc,
  Timestamp,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { dataValida } from './calendar'
import { ErroreApp, rifDSA, rifMembri } from './classi'
import {
  creaInterrogazione,
  pulisciInterrogazione,
  rifInterrogazione,
  rifInterrogazioni,
  rifLista,
  rifPreferenza,
  rifPreferenze,
  rifRapporto,
  type DatiInterrogazione,
} from './configurazione'
import { generaLista, preferenzeDa, semeCasuale, type Risultato, type Scelta } from './generateList'
import { aggiungiVoceStorico } from './storico'
import { senzaEsclusi } from './lista'
import { confrontaCognomi } from './membri'
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

/** Crea l'interrogazione dal modulo: con la lista (raccolta delle preferenze) o senza. */
export async function creaDaModulo(db: Firestore, classId: string, subjectId: string, d: DatiInterrogazione, mioUid: string): Promise<string> {
  return d.senzaLista ? creaSenzaLista(db, classId, subjectId, d, mioUid) : creaInterrogazione(db, classId, subjectId, d, mioUid)
}

/**
 * Interrogazione senza lista (decide il docente, giorno per giorno): nasce già "in corso",
 * con tutti gli studenti in ordine di cognome, solo per tenere conto di chi è stato interrogato.
 */
export async function creaSenzaLista(db: Firestore, classId: string, subjectId: string, d: DatiInterrogazione, mioUid: string): Promise<string> {
  const adesso = new Date()
  const p = pulisciInterrogazione({ ...d, perLezione: null, scadenzaPreferenze: adesso })
  const membri = await getDocs(rifMembri(db, classId))
  const ordine = membri.docs
    .map((m) => m.data() as Membro)
    .filter((m) => m.ruolo !== 'docente')
    .sort((a, b) => confrontaCognomi(a.nome, b.nome))
    .map((m) => m.uid)
  const rif = doc(rifInterrogazioni(db, classId, subjectId))
  const r = { classId, subjectId, interrogazioneId: rif.id }
  const batch = writeBatch(db)
  const voce = aggiungiVoceStorico(db, batch, r, mioUid, 'generata', {})
  batch.set(rif, {
    ...p,
    scadenzaPreferenze: Timestamp.fromDate(adesso),
    senzaLista: true,
    stato: 'lista',
    creato: serverTimestamp(),
    creatoDa: mioUid,
    aggiornato: serverTimestamp(),
  })
  batch.set(rifLista(db, classId, subjectId, rif.id), {
    ordine,
    fissi: {},
    interrogati: {},
    generata: serverTimestamp(),
    generataDa: mioUid,
    ultimaModifica: voce,
  })
  await batch.commit()
  return rif.id
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
  const studenti = senzaEsclusi(
    membri.docs.map((d) => d.data() as Membro).filter((m) => m.ruolo !== 'docente').map((m) => m.uid),
    dati.esclusi,
  )
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
