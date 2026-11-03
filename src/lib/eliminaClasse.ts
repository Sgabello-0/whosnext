import { getDocs, writeBatch, type DocumentReference, type Firestore } from 'firebase/firestore'
import { ErroreApp, rifClasse, rifDSA, rifInvito, rifMembri } from './classi'
import { rifCalendario, rifInterrogazioni, rifMaterie } from './configurazione'

/** Massimo di scritture in un batch di Firestore (500), con un po' di margine. */
const MAX_SCRITTURE = 480

/**
 * Il capoclasse elimina la classe con tutto quello che contiene:
 * membri, badge DSA/BES, calendario, materie, interrogazioni e codice d'invito.
 * Tutto in un'unica operazione: o sparisce tutto o niente.
 */
export async function eliminaClasse(db: Firestore, classId: string, codiceInvito: string): Promise<void> {
  const [membri, dsa, materie] = await Promise.all([
    getDocs(rifMembri(db, classId)),
    getDocs(rifDSA(db, classId)),
    getDocs(rifMaterie(db, classId)),
  ])
  const interrogazioni = await Promise.all(materie.docs.map((m) => getDocs(rifInterrogazioni(db, classId, m.id))))

  const daCancellare: DocumentReference[] = [
    ...interrogazioni.flatMap((q) => q.docs.map((d) => d.ref)),
    ...materie.docs.map((d) => d.ref),
    ...dsa.docs.map((d) => d.ref),
    rifCalendario(db, classId),
    ...membri.docs.map((d) => d.ref),
    rifInvito(db, codiceInvito),
    rifClasse(db, classId),
  ]
  if (daCancellare.length > MAX_SCRITTURE) {
    throw new ErroreApp('dati-non-validi', 'La classe contiene troppi dati per essere eliminata in una volta.')
  }

  const batch = writeBatch(db)
  for (const rif of daCancellare) batch.delete(rif)
  await batch.commit()
}
