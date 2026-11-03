import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CLASSE_INPUT } from './ui'

export type OpzioniConferma = {
  titolo: string
  testo?: ReactNode
  /** testo del pulsante che conferma (es. "Elimina") */
  pulsante: string
  /** pulsante rosso per le azioni distruttive */
  pericolo?: boolean
  /** per azioni gravi: bisogna scrivere questo testo per poter confermare */
  richiediTesto?: string
}

type Richiesta = { opz: OpzioniConferma; risolvi: (ok: boolean) => void }

const ContestoConferma = createContext<((o: OpzioniConferma) => Promise<boolean>) | null>(null)

/** Finestra di conferma al posto di window.confirm (più comoda su telefono, accessibile). */
export function ProviderConferma({ children }: { children: ReactNode }) {
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null)
  const [scritto, setScritto] = useState('')
  const finestra = useRef<HTMLDialogElement>(null)

  const conferma = useCallback(
    (opz: OpzioniConferma) =>
      new Promise<boolean>((risolvi) => {
        setScritto('')
        setRichiesta({ opz, risolvi })
      }),
    [],
  )

  useEffect(() => {
    const d = finestra.current
    if (richiesta && d && !d.open) d.showModal()
  }, [richiesta])

  function chiudi(ok: boolean) {
    richiesta?.risolvi(ok)
    setRichiesta(null)
    finestra.current?.close()
  }

  const opz = richiesta?.opz
  const testoOk = !opz?.richiediTesto || scritto.trim() === opz.richiediTesto

  return (
    <ContestoConferma.Provider value={conferma}>
      {children}
      <dialog
        ref={finestra}
        aria-labelledby="conferma-titolo"
        onCancel={(e) => {
          e.preventDefault()
          chiudi(false)
        }}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50 dark:bg-slate-900 dark:text-slate-100"
      >
        {opz && (
          <form
            method="dialog"
            className="space-y-4 p-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (testoOk) chiudi(true)
            }}
          >
            <h2 id="conferma-titolo" className="text-lg font-semibold">
              {opz.titolo}
            </h2>
            {opz.testo && <div className="text-sm text-slate-600 dark:text-slate-400">{opz.testo}</div>}
            {opz.richiediTesto && (
              <label className="block text-sm">
                <span className="mb-2 block font-medium">Per confermare scrivi: {opz.richiediTesto}</span>
                <input
                  value={scritto}
                  onChange={(e) => setScritto(e.target.value)}
                  autoComplete="off"
                  className={CLASSE_INPUT}
                />
              </label>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => chiudi(false)}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={!testoOk}
                autoFocus={!opz.richiediTesto}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
                  opz.pericolo ? 'bg-rose-700 hover:bg-rose-800' : 'bg-accento hover:bg-blue-700'
                }`}
              >
                {opz.pulsante}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </ContestoConferma.Provider>
  )
}

export function useConferma(): (o: OpzioniConferma) => Promise<boolean> {
  const c = useContext(ContestoConferma)
  if (!c) throw new Error('useConferma va usato dentro <ProviderConferma>')
  return c
}
