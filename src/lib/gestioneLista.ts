/**
 * Modifiche alla lista generata: riordino, interrogati, segnalazioni "Sono stato interrogato".
 * Le fanno capo, vice e docenti con permesso (le segnalazioni anche gli studenti).
 */
import {
  deleteField,
  FieldPath,
  getDoc,
  serverTimestamp,
  setDoc,
  deleteDoc,
  writeBatch,
  type Firestore,
} from 'firebase/firestore'
import { dataValida } from './calendar'
import { ErroreApp } from './classi'
import { rifInterrogazione, rifLista, rifSegnalazione } from './configurazione'
import { spostati, stessiElementi, tuttiInterrogati } from './lista'
import { aggiungiVoceStorico } from './storico'
import type { DocLista, Interrogazione } from './tipi'

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

const listaDi = (db: Firestore, r: Rif) => rifLista(db, r.classId, r.subjectId, r.interrogazioneId)
const interrogazioneDi = (db: Firestore, r: Rif) => rifInterrogazione(db, r.classId, r.subjectId, r.interrogazioneId)

async function leggi(db: Firestore, r: Rif): Promise<{ lista: DocLista; stato: Interrogazione['stato'] }> {
  const [lista, interr] = await Promise.all([getDoc(listaDi(db, r)), getDoc(interrogazioneDi(db, r))])
  if (!lista.exists() || !interr.exists()) throw new ErroreApp('dati-non-validi', 'La lista non esiste più.')
  return { lista: lista.data() as DocLista, stato: (interr.data() as Interrogazione).stato }
}

/** Salva un nuovo ordine (stesse persone, ordine diverso). */
export async function riordinaLista(db: Firestore, r: Rif, nuovoOrdine: string[], mioUid: string): Promise<void> {
  const { lista } = await leggi(db, r)
  if (!stessiElementi(lista.ordine, nuovoOrdine)) {
    throw new ErroreApp('dati-non-validi', 'La lista è cambiata nel frattempo: ricarica la pagina e riprova.')
  }
  const batch = writeBatch(db)
  const voce = aggiungiVoceStorico(db, batch, r, mioUid, 'riordino', { spostati: spostati(lista.ordine, nuovoOrdine) })
  batch.update(listaDi(db, r), {
    ordine: nuovoOrdine,
    aggiornato: serverTimestamp(),
    aggiornatoDa: mioUid,
    ultimaModifica: voce,
  })
  await batch.commit()
}

/**
 * Segna come interrogati gli studenti indicati, nel giorno indicato, e toglie le loro segnalazioni.
 * Se così sono stati interrogati tutti, l'interrogazione diventa "conclusa".
 */
export async function segnaInterrogati(db: Firestore, r: Rif, uids: string[], data: string, mioUid: string): Promise<void> {
  if (!dataValida(data)) throw new ErroreApp('dati-non-validi', 'Indica il giorno della lezione.')
  if (uids.length === 0) return
  const { lista, stato } = await leggi(db, r)
  const interrogati = { ...lista.interrogati }
  for (const u of uids) interrogati[u] = data

  const batch = writeBatch(db)
  const voce = aggiungiVoceStorico(db, batch, r, mioUid, 'interrogati', { uids, data })
  const campi: unknown[] = []
  for (const u of uids) campi.push(new FieldPath('interrogati', u), data)
  batch.update(
    listaDi(db, r),
    new FieldPath('aggiornato'),
    serverTimestamp(),
    new FieldPath('aggiornatoDa'),
    mioUid,
    new FieldPath('ultimaModifica'),
    voce,
    ...campi,
  )
  for (const u of uids) batch.delete(rifSegnalazione(db, r.classId, r.subjectId, r.interrogazioneId, u))
  if (stato === 'lista' && tuttiInterrogati(lista.ordine, interrogati, lista.fissi)) {
    batch.update(interrogazioneDi(db, r), { stato: 'conclusa', aggiornato: serverTimestamp() })
  }
  await batch.commit()
}

/** Toglie il segno "interrogato" (ad esempio se segnato per sbaglio). */
export async function togliInterrogato(db: Firestore, r: Rif, uid: string, mioUid: string): Promise<void> {
  const { stato, lista } = await leggi(db, r)
  const batch = writeBatch(db)
  const voce = aggiungiVoceStorico(db, batch, r, mioUid, 'annullato', { uid, data: lista.interrogati[uid] ?? '' })
  batch.update(
    listaDi(db, r),
    new FieldPath('interrogati', uid),
    deleteField(),
    new FieldPath('aggiornato'),
    serverTimestamp(),
    new FieldPath('aggiornatoDa'),
    mioUid,
    new FieldPath('ultimaModifica'),
    voce,
  )
  if (stato === 'conclusa') batch.update(interrogazioneDi(db, r), { stato: 'lista', aggiornato: serverTimestamp() })
  await batch.commit()
}

/** Lo studente segnala di essere stato interrogato; capo o vice confermeranno. */
export async function segnalaInterrogato(db: Firestore, r: Rif, uid: string, data: string): Promise<void> {
  if (!dataValida(data)) throw new ErroreApp('dati-non-validi', 'Indica il giorno.')
  await setDoc(rifSegnalazione(db, r.classId, r.subjectId, r.interrogazioneId, uid), { data, quando: serverTimestamp() })
}

/** Ritira la segnalazione (lo studente) o la rifiuta (capo, vice, docente con permesso). */
export async function togliSegnalazione(db: Firestore, r: Rif, uid: string): Promise<void> {
  await deleteDoc(rifSegnalazione(db, r.classId, r.subjectId, r.interrogazioneId, uid))
}
