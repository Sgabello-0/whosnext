import { useMemo } from 'react'
import type { FirestoreError } from 'firebase/firestore'
import { useProfilo } from './auth'
import { db } from './firebase'
import { rifClasse, rifDSA, rifDSAMembro, rifMembri, rifMembro } from './classi'
import { useDocumento, useQuery, type ConId } from './hooks'
import { puoGestireDSA } from './membri'
import type { Classe, Membro } from './tipi'

export type DatiClasse =
  | { stato: 'caricamento' }
  | { stato: 'non-membro' }
  | { stato: 'errore'; errore: FirestoreError }
  | {
      stato: 'pronto'
      classe: ConId<Classe>
      io: ConId<Membro>
      membri: ConId<Membro>[]
      /** uid con badge DSA/BES che l'utente può vedere (tutti per capo e vice, solo sé stessi per gli altri) */
      dsa: Set<string>
    }

/** Tutto quello che serve per le pagine di una classe, in tempo reale. */
export function useClasse(classId: string): DatiClasse {
  const { uid } = useProfilo()
  const io = useDocumento<Membro>(db && rifMembro(db, classId, uid))
  const membro = io.dati ?? null
  const staff = puoGestireDSA(membro)

  // Classe e membri si leggono solo da membri: si aspetta di sapere se lo si è.
  const classe = useDocumento<Classe>(db && membro ? rifClasse(db, classId) : null)
  const membri = useQuery<Membro>(db && membro ? rifMembri(db, classId) : null, membro ? `membri/${classId}` : null)
  const tuttiDSA = useQuery<object>(db && staff ? rifDSA(db, classId) : null, staff ? `dsa/${classId}` : null)
  const mioDSA = useDocumento<object>(db && membro && !staff ? rifDSAMembro(db, classId, uid) : null)

  const dsa = useMemo(() => {
    if (staff) return new Set((tuttiDSA.dati ?? []).map((d) => d.id))
    return new Set(mioDSA.dati ? [uid] : [])
  }, [staff, tuttiDSA.dati, mioDSA.dati, uid])

  const errore = io.errore ?? classe.errore ?? membri.errore
  if (errore?.code === 'permission-denied') return { stato: 'non-membro' }
  if (errore) return { stato: 'errore', errore }
  if (io.dati === null || classe.dati === null) return { stato: 'non-membro' }
  if (!io.dati || !classe.dati || !membri.dati) return { stato: 'caricamento' }
  return { stato: 'pronto', classe: classe.dati, io: io.dati, membri: membri.dati, dsa }
}
