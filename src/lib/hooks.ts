import { useEffect, useState } from 'react'
import { onSnapshot, type DocumentReference, type FirestoreError, type Query } from 'firebase/firestore'

export type ConId<T> = T & { id: string; percorso: string }

type Stato<T> = { dati: T | undefined; errore: FirestoreError | null }

/**
 * Legge un documento in tempo reale.
 * dati: undefined mentre carica, null se non esiste.
 */
export function useDocumento<T>(rif: DocumentReference | null): Stato<ConId<T> | null> {
  const percorso = rif?.path ?? null
  const [stato, setStato] = useState<Stato<ConId<T> | null> & { percorso: string | null }>({
    dati: undefined,
    errore: null,
    percorso,
  })

  useEffect(() => {
    if (!rif) return
    return onSnapshot(
      rif,
      (snap) =>
        setStato({
          dati: snap.exists() ? ({ ...(snap.data() as T), id: snap.id, percorso: snap.ref.path } as ConId<T>) : null,
          errore: null,
          percorso: rif.path,
        }),
      (errore) => setStato({ dati: undefined, errore, percorso: rif.path }),
    )
    // Dipendenza voluta: il riferimento cambia a ogni render, il percorso no
  }, [percorso])

  // Evita di mostrare per un attimo i dati del documento precedente
  return stato.percorso === percorso ? stato : { dati: undefined, errore: null }
}

/**
 * Legge una query in tempo reale. `chiave` identifica la query (cambia → si riparte).
 * dati: undefined mentre carica.
 */
export function useQuery<T>(q: Query | null, chiave: string | null): Stato<ConId<T>[]> {
  const [stato, setStato] = useState<Stato<ConId<T>[]> & { chiave: string | null }>({
    dati: undefined,
    errore: null,
    chiave,
  })

  useEffect(() => {
    if (!q) return
    return onSnapshot(
      q,
      (snap) =>
        setStato({
          dati: snap.docs.map((d) => ({ ...(d.data() as T), id: d.id, percorso: d.ref.path }) as ConId<T>),
          errore: null,
          chiave,
        }),
      (errore) => setStato({ dati: undefined, errore, chiave }),
    )
    // Dipendenza voluta: la query cambia a ogni render, la chiave no
  }, [chiave])

  return stato.chiave === chiave ? stato : { dati: undefined, errore: null }
}
