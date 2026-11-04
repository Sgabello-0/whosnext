import { useEffect, useState } from 'react'
import { installa, tipoTelefono, useInstallazione, type Telefono } from '../lib/installazione'
import { Download, EllipsisVertical, Maximize2, Share, WifiOff, X, Zap } from 'lucide-react'
import { Logo } from './Logo'
import { Bottone } from './ui'

const CHIAVE = 'installa-app-rimandato'
const UNA_SETTIMANA = 7 * 24 * 3_600_000
/** Dopo quanto compare: non appena si apre la pagina, ma quando si è già visto qualcosa. */
const RITARDO = 4_000

function rimandato(): boolean {
  try {
    const quando = Number(localStorage.getItem(CHIAVE) ?? 0)
    return Date.now() - quando < UNA_SETTIMANA
  } catch {
    return false
  }
}

const VANTAGGI = [
  { icona: Zap, testo: 'Si apre con un tocco' },
  { icona: WifiOff, testo: 'Funziona anche senza rete' },
  { icona: Maximize2, testo: 'A schermo intero' },
]

/**
 * Da cellulare: invito discreto (in basso, dopo qualche secondo) a mettere l'app nella schermata Home.
 * Su Android basta un tocco su "Installa"; su iPhone i browser non lo permettono, quindi spiega i due passaggi.
 */
/** Il pulsante "Installa" (Android) o i passaggi da fare a mano (iPhone, app social, altri browser). */
export function IstruzioniInstallazione(props: { telefono: Telefono; onInstallata?: () => void; altro?: React.ReactNode }) {
  const { proponibile } = useInstallazione()
  if (proponibile) {
    return (
      <div className="flex flex-wrap gap-2">
        <Bottone icona={Download} onClick={async () => (await installa()) && props.onInstallata?.()}>
          Installa
        </Bottone>
        {props.altro}
      </div>
    )
  }
  const testo =
    props.telefono === 'iphone' ? (
      <>
        Tocca <Share aria-label="Condividi" className="inline size-4 align-text-bottom text-accento" /> <strong>Condividi</strong> (o il
        menu <strong>…</strong>), poi <strong>Aggiungi alla schermata Home</strong>.
      </>
    ) : props.telefono === 'app-social' ? (
      <>
        Da qui non si può installare: apri il link in <strong>Chrome</strong> o <strong>Safari</strong> (menu in alto, "Apri nel
        browser").
      </>
    ) : props.telefono === 'android' ? (
      <>
        Tocca <EllipsisVertical aria-label="il menu" className="inline size-4 align-text-bottom text-accento" /> in alto a destra, poi{' '}
        <strong>Installa app</strong> (o <strong>Aggiungi a schermata Home</strong>).
      </>
    ) : (
      <>
        Da computer, con Chrome o Edge: l'icona di installazione è a destra nella barra dell'indirizzo. Sul telefono apri questo sito e
        segui le istruzioni.
      </>
    )
  return <p className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-950/50">{testo}</p>
}

/**
 * Da cellulare: invito discreto (in basso, dopo qualche secondo) a mettere l'app nella schermata Home.
 * Su Android basta un tocco su "Installa"; su iPhone i browser non lo permettono, quindi spiega i due passaggi.
 */
export function InstallaApp() {
  const telefono = tipoTelefono()
  const { installata } = useInstallazione()
  const [nascosto, setNascosto] = useState(() => !telefono || rimandato())
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setPronto(true), RITARDO)
    return () => clearTimeout(t)
  }, [])

  function nonOra() {
    try {
      localStorage.setItem(CHIAVE, String(Date.now()))
    } catch {
      /* va bene anche solo per questa visita */
    }
    setNascosto(true)
  }

  if (nascosto || installata || !pronto) return null

  return (
    <section
      aria-labelledby="titolo-installa"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] motion-safe:animate-[sali_220ms_ease-out]"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <Logo />
          <div className="min-w-0 flex-1">
            <h2 id="titolo-installa" className="font-semibold">
              Installa l'app
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Metti WhosNext nella schermata Home</p>
          </div>
          <button
            type="button"
            onClick={nonOra}
            aria-label="Chiudi"
            className="-mt-1 -mr-1 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X aria-hidden className="size-4.5" />
          </button>
        </div>

        <Vantaggi />

        <div className="mt-4">
          <IstruzioniInstallazione
            telefono={telefono}
            onInstallata={() => setNascosto(true)}
            altro={
              <Bottone variante="tenue" onClick={nonOra}>
                Non ora
              </Bottone>
            }
          />
        </div>
      </div>
    </section>
  )
}

export function Vantaggi() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
      {VANTAGGI.map(({ icona: Icona, testo }) => (
        <li key={testo} className="flex items-center gap-1.5">
          <Icona aria-hidden className="size-3.5 text-accento dark:text-blue-300" />
          {testo}
        </li>
      ))}
    </ul>
  )
}
