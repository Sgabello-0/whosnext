/** Generazione automatica delle liste alla scadenza delle preferenze (stesso algoritmo del sito). */
import { FieldValue, Timestamp, type DocumentReference, type Firestore } from 'firebase-admin/firestore'
import { generaLista, preferenzeDa, semeCasuale, type Scelta } from '../../src/lib/generateList'

export type Rif = { classId: string; subjectId: string; interrogazioneId: string }

export function rifDa(percorso: string): Rif {
  // classes/{c}/subjects/{s}/interrogations/{i}
  const p = percorso.split('/')
  return { classId: p[1]!, subjectId: p[3]!, interrogazioneId: p[5]! }
}

export function percorsoDi(r: Rif): string {
  return `classes/${r.classId}/subjects/${r.subjectId}/interrogations/${r.interrogazioneId}`
}

/** Genera e pubblica la lista di un'interrogazione, se è ancora in raccolta e scaduta. null se non serviva. */
export async function generaSeScaduta(db: Firestore, ref: DocumentReference, adesso: Date, seme = semeCasuale()) {
  const r = rifDa(ref.path)
  return db.runTransaction(async (tx) => {
    const interr = await tx.get(ref)
    const dati = interr.data()
    if (!dati || dati.stato !== 'raccolta' || (dati.scadenzaPreferenze as Timestamp).toDate() > adesso) return null
    const classe = db.collection('classes').doc(r.classId)
    const [membri, dsa, preferenze] = await Promise.all([
      tx.get(classe.collection('members')),
      tx.get(classe.collection('dsa')),
      tx.get(ref.collection('preferences')),
    ])
    const risultato = generaLista({
      studenti: membri.docs.filter((m) => m.data().ruolo !== 'docente').map((m) => m.id),
      preferenze: preferenzeDa(
        preferenze.docs.map((d) => ({ id: d.id, dati: d.data() as { scelta: Scelta; dataDSA?: string | null; aggiornato?: Timestamp } })),
      ),
      dsa: new Set(dsa.docs.map((d) => d.id)),
      seme,
    })
    const voce = ref.collection('storico').doc()
    tx.set(voce, { tipo: 'generata', chi: 'automatico', quando: FieldValue.serverTimestamp(), dettagli: { seme } })
    tx.set(ref.collection('list').doc('current'), {
      ordine: risultato.ordine,
      fissi: risultato.fissi,
      interrogati: {},
      generata: FieldValue.serverTimestamp(),
      generataDa: 'automatico',
      ultimaModifica: voce.id,
    })
    tx.set(ref.collection('list').doc('rapporto'), { ...risultato.rapporto, generata: FieldValue.serverTimestamp() })
    tx.update(ref, { stato: 'lista', aggiornato: FieldValue.serverTimestamp() })
    return { r, ordine: risultato.ordine, fissi: risultato.fissi }
  })
}

/** Tutte le interrogazioni con le preferenze scadute ancora da generare. */
export async function generaScadute(db: Firestore, adesso: Date): Promise<Rif[]> {
  const scadute = await db
    .collectionGroup('interrogations')
    .where('stato', '==', 'raccolta')
    .where('scadenzaPreferenze', '<=', Timestamp.fromDate(adesso))
    .get()
  const fatte: Rif[] = []
  for (const d of scadute.docs) {
    try {
      const esito = await generaSeScaduta(db, d.ref, adesso)
      if (esito) fatte.push(esito.r)
    } catch (e) {
      // un'interrogazione con dati rovinati non deve fermare le altre
      console.error(`Generazione non riuscita per ${d.ref.path}:`, e)
    }
  }
  return fatte
}
