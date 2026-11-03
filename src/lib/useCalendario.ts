import { useMemo } from 'react'
import { db } from './firebase'
import { calendarioDa, type Calendario } from './calendar'
import { rifCalendario } from './configurazione'
import { useDocumento } from './hooks'

/** Calendario della classe in tempo reale (valori predefiniti se non è ancora stato salvato). */
export function useCalendario(classId: string): { cal: Calendario | undefined; salvato: boolean } {
  const doc = useDocumento<Partial<Calendario>>(db && rifCalendario(db, classId))
  const cal = useMemo(() => (doc.dati === undefined ? undefined : calendarioDa(doc.dati)), [doc.dati])
  return { cal, salvato: !!doc.dati }
}
