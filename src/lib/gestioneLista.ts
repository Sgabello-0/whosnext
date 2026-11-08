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
import { avvisaServer } from './avvisaServer'
import { dataValida } from './calendar'
import { ErroreApp } from './classi'
import { rifInterrogazione, rifLista, rifSegnalazione } from './configurazione'
import {
  aggiungiInFondo,
  conDataFissa,
  spostati,
  statoInLista,
  stessiElementi,
  togliDallaLista,
  tuttiInterrogati,
  type Composizione,
} from './lista'
import { aggiungiVoceStorico } from './storico'
import type { DocLista, Interrogazione } from './tipi'

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

const listaDi = (db: Firestore, r: Rif) => rifLista(db, r.classId, r.subjectId, r.interrogazioneId)
const interrogazioneDi = (db: Firestore, r: Rif) => rifInterrogazione(db, r.classId, r.subjectId, r.interrogazioneId)
/** La lista com'era: va nello storico, così il server sa chi ha cambiato posto. */
const fotografia = (l: DocLista): Composizione => ({ ordine: l.ordine, fissi: l.fissi ?? {}, interrogati: l.interrogati })

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
  const voce = aggiungiVoceStorico(db, batch, r, mioUid, 'riordino', { spostati: spostati(lista.ordine, nuovoOrdine), prima: fotografia(lista) })
  batch.update(listaDi(db, r), {
    ordine: nuovoOrdine,
    aggiornato: serverTimestamp(),
    aggiornatoDa: mioUid,
    ultimaModifica: voce,
  })
  await batch.commit()
  avvisaServer('cambio-lista', r, voce)
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

export type Imprevisto =
  /** in fondo alla lista (chi era fuori, o chi aveva la data fissa) */
  | { tipo: 'aggiungi'; uid: string }
  /** data fissa per quel giorno (anche per cambiarla) */
  | { tipo: 'fissa'; uid: string; data: string }
  /** fuori dalla lista */
  | { tipo: 'togli'; uid: string }

/**
 * Imprevisti (solo capo e vice): rimettere in lista, fissare una data, togliere qualcuno.
 * Insieme si aggiorna lo stato: conclusa se restano solo interrogati, di nuovo in corso se rientra qualcuno.
 */
export async function gestisciImprevisto(db: Firestore, r: Rif, i: Imprevisto, mioUid: string): Promise<void> {
  if (i.tipo === 'fissa' && !dataValida(i.data)) throw new ErroreApp('dati-non-validi', 'Scegli il giorno.')
  const { lista, stato } = await leggi(db, r)
  const prima = fotografia(lista)
  const dove = statoInLista(prima, i.uid)
  const dopo =
    i.tipo === 'aggiungi' ? aggiungiInFondo(prima, i.uid) : i.tipo === 'fissa' ? conDataFissa(prima, i.uid, i.data) : togliDallaLista(prima, i.uid)

  const batch = writeBatch(db)
  const voce =
    i.tipo === 'aggiungi'
      ? aggiungiVoceStorico(db, batch, r, mioUid, dove === 'fissa' ? 'liberato' : 'aggiunto', { uid: i.uid, prima })
      : i.tipo === 'fissa'
        ? aggiungiVoceStorico(db, batch, r, mioUid, 'fissato', { uid: i.uid, data: i.data, prima })
        : aggiungiVoceStorico(db, batch, r, mioUid, 'tolto', { uid: i.uid, prima })
  batch.update(listaDi(db, r), {
    ordine: dopo.ordine,
    fissi: dopo.fissi,
    interrogati: dopo.interrogati,
    aggiornato: serverTimestamp(),
    aggiornatoDa: mioUid,
    ultimaModifica: voce,
  })
  const tutti = tuttiInterrogati(dopo.ordine, dopo.interrogati, dopo.fissi)
  if (stato === 'lista' && tutti) batch.update(interrogazioneDi(db, r), { stato: 'conclusa', aggiornato: serverTimestamp() })
  if (stato === 'conclusa' && !tutti) batch.update(interrogazioneDi(db, r), { stato: 'lista', aggiornato: serverTimestamp() })
  if (i.tipo === 'togli') batch.delete(rifSegnalazione(db, r.classId, r.subjectId, r.interrogazioneId, i.uid))
  await batch.commit()
  avvisaServer('cambio-lista', r, voce)
}

/**
 * "Non ci sarò": lo studente esce dall'ordine e prende una data fissa, `nuova`.
 * Vale per chiunque sia in lista e non ancora interrogato; chi avvisare lo decide il server.
 */
export async function dichiaraAssenza(db: Firestore, r: Rif, uid: string, data: string, nuova: string): Promise<void> {
  if (!dataValida(data) || !dataValida(nuova)) throw new ErroreApp('dati-non-validi', 'Scegli il giorno.')
  const { lista, stato } = await leggi(db, r)
  const fissi = lista.fissi ?? {}
  if (stato !== 'lista' || lista.interrogati[uid] || !(lista.ordine.includes(uid) || uid in fissi)) {
    throw new ErroreApp('dati-non-validi', 'Non sei più tra chi deve essere interrogato.')
  }
  const batch = writeBatch(db)
  const voce = aggiungiVoceStorico(db, batch, r, uid, 'assenza', { uid, data, nuova, prima: fotografia(lista) })
  batch.update(listaDi(db, r), {
    ordine: lista.ordine.filter((u) => u !== uid),
    fissi: { ...fissi, [uid]: nuova },
    aggiornato: serverTimestamp(),
    aggiornatoDa: uid,
    ultimaModifica: voce,
  })
  await batch.commit()
  avvisaServer('cambio-lista', r, voce)
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
