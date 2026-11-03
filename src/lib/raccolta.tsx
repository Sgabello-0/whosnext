import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { InterrogazioneOsservata } from './daFare'

type Registra = (chiave: string, dati: InterrogazioneOsservata | null) => void

// Due contesti separati: chi registra non si ridisegna quando cambia la raccolta.
const ContestoRegistra = createContext<Registra | null>(null)
const ContestoVoci = createContext<InterrogazioneOsservata[] | null>(null)

/**
 * Raccoglie le interrogazioni osservate dai componenti "osservatori" sparsi nella pagina,
 * così "Le mie interrogazioni" e "Da fare" le possono ordinare e mostrare tutte insieme.
 */
export function ProviderRaccolta({ children }: { children: ReactNode }) {
  const [mappa, setMappa] = useState(() => new Map<string, { json: string; dati: InterrogazioneOsservata }>())

  const registra = useCallback<Registra>((chiave, dati) => {
    setMappa((prima) => {
      if (dati === null) {
        if (!prima.has(chiave)) return prima
        const dopo = new Map(prima)
        dopo.delete(chiave)
        return dopo
      }
      const json = JSON.stringify(dati)
      // Niente aggiornamento se non è cambiato nulla: evita di ridisegnare all'infinito
      if (prima.get(chiave)?.json === json) return prima
      const dopo = new Map(prima)
      dopo.set(chiave, { json, dati })
      return dopo
    })
  }, [])

  const voci = useMemo(() => [...mappa.values()].map((v) => v.dati), [mappa])

  return (
    <ContestoRegistra.Provider value={registra}>
      <ContestoVoci.Provider value={voci}>{children}</ContestoVoci.Provider>
    </ContestoRegistra.Provider>
  )
}

/** Registra (o aggiorna) un'interrogazione osservata; la toglie quando il componente sparisce. */
export function useRegistra(chiave: string, dati: InterrogazioneOsservata | null): void {
  const registra = useContext(ContestoRegistra)
  if (!registra) throw new Error('useRegistra va usato dentro <ProviderRaccolta>')
  const json = dati ? JSON.stringify(dati) : null

  useEffect(() => {
    registra(chiave, dati)
    // Dipendenza voluta: `json` cambia solo quando cambiano davvero i dati
  }, [registra, chiave, json])

  useEffect(() => () => registra(chiave, null), [registra, chiave])
}

export function useInterrogazioniOsservate(): InterrogazioneOsservata[] {
  const voci = useContext(ContestoVoci)
  if (!voci) throw new Error('useInterrogazioniOsservate va usato dentro <ProviderRaccolta>')
  return voci
}
