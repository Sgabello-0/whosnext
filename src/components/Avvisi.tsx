import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type Avviso = {
  id: number
  testo: string
  tono: 'ok' | 'errore'
  annulla?: () => Promise<void>
}

type ApiAvvisi = {
  /** Messaggio breve dopo un'azione; con `annulla` compare il pulsante per tornare indietro. */
  mostra: (testo: string, opzioni?: { annulla?: () => Promise<void> }) => void
  errore: (testo: string) => void
}

const ContestoAvvisi = createContext<ApiAvvisi | null>(null)
const DURATA_MS = 6000

export function ProviderAvvisi({ children }: { children: ReactNode }) {
  const [avvisi, setAvvisi] = useState<Avviso[]>([])
  const prossimoId = useRef(1)

  const togli = useCallback((id: number) => setAvvisi((a) => a.filter((x) => x.id !== id)), [])

  const aggiungi = useCallback((avviso: Omit<Avviso, 'id'>) => {
    const id = prossimoId.current++
    // Uno alla volta: su telefono più avvisi coprirebbero i pulsanti. Il nuovo sostituisce il vecchio.
    setAvvisi([{ ...avviso, id }])
  }, [])

  const api = useMemo<ApiAvvisi>(
    () => ({
      mostra: (testo, opzioni) => aggiungi({ testo, tono: 'ok', annulla: opzioni?.annulla }),
      errore: (testo) => aggiungi({ testo, tono: 'errore' }),
    }),
    [aggiungi],
  )

  return (
    <ContestoAvvisi.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {avvisi.map((a) => (
          <ElementoAvviso key={a.id} avviso={a} togli={togli} onErrore={api.errore} />
        ))}
      </div>
    </ContestoAvvisi.Provider>
  )
}

function ElementoAvviso(p: { avviso: Avviso; togli: (id: number) => void; onErrore: (t: string) => void }) {
  const [inCorso, setInCorso] = useState(false)
  const { avviso, togli } = p
  const onChiudi = () => togli(avviso.id)

  useEffect(() => {
    const t = setTimeout(() => togli(avviso.id), DURATA_MS)
    return () => clearTimeout(t)
  }, [avviso.id, togli])

  async function annulla() {
    if (!avviso.annulla) return
    setInCorso(true)
    try {
      await avviso.annulla()
      onChiudi()
    } catch (e) {
      onChiudi()
      p.onErrore(e instanceof Error ? e.message : 'Non è stato possibile annullare.')
    }
  }

  return (
    <div
      role={avviso.tono === 'errore' ? 'alert' : 'status'}
      className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ${
        avviso.tono === 'errore' ? 'bg-rose-700 text-white' : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
      }`}
    >
      <span className="min-w-0 flex-1">{avviso.testo}</span>
      {avviso.annulla && (
        <button
          type="button"
          onClick={annulla}
          disabled={inCorso}
          aria-label={`Annulla: ${avviso.testo}`}
          className="shrink-0 rounded-md px-2 py-1 font-semibold text-blue-300 hover:bg-white/10 disabled:opacity-60 dark:text-accento dark:hover:bg-black/10"
        >
          Annulla
        </button>
      )}
      <button
        type="button"
        onClick={onChiudi}
        aria-label="Chiudi avviso"
        className="shrink-0 rounded-md px-1.5 py-1 opacity-70 hover:opacity-100"
      >
        ✕
      </button>
    </div>
  )
}

export function useAvvisi(): ApiAvvisi {
  const c = useContext(ContestoAvvisi)
  if (!c) throw new Error('useAvvisi va usato dentro <ProviderAvvisi>')
  return c
}
