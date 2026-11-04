import { useEffect, useState } from 'react'
import { Download, EllipsisVertical, Maximize2, Share, WifiOff, X, Zap } from 'lucide-react'
import { Logo } from './Logo'
import { Bottone } from './ui'

/** Evento di Chrome/Android per proporre l'installazione (non è nei tipi standard). */
type EventoInstallazione = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const CHIAVE = 'installa-app-rimandato'
const UNA_SETTIMANA = 7 * 24 * 3_600_000
/** Dopo quanto compare: non appena si apre la pagina, ma quando si è già visto qualcosa. */
const RITARDO = 4_000

type Telefono = 'android' | 'iphone' | 'app-social' | null

function tipoTelefono(): Telefono {
  const ua = navigator.userAgent
  // dentro Instagram, Facebook, TikTok… non si può installare: va aperto nel browser
  if (/Instagram|FBAN|FBAV|TikTok|Line\//i.test(ua)) return 'app-social'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iphone'
  if (/Android/.test(ua)) return 'android'
  return null
}

function giaInstallata(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

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
export function InstallaApp() {
  const telefono = tipoTelefono()
  const [evento, setEvento] = useState<EventoInstallazione | null>(null)
  const [nascosto, setNascosto] = useState(() => !telefono || giaInstallata() || rimandato())
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const proponi = (e: Event) => {
      e.preventDefault()
      setEvento(e as EventoInstallazione)
    }
    const installata = () => setNascosto(true)
    window.addEventListener('beforeinstallprompt', proponi)
    window.addEventListener('appinstalled', installata)
    const t = setTimeout(() => setPronto(true), RITARDO)
    return () => {
      window.removeEventListener('beforeinstallprompt', proponi)
      window.removeEventListener('appinstalled', installata)
      clearTimeout(t)
    }
  }, [])

  function nonOra() {
    try {
      localStorage.setItem(CHIAVE, String(Date.now()))
    } catch {
      /* va bene anche solo per questa visita */
    }
    setNascosto(true)
  }

  async function installa() {
    if (!evento) return
    await evento.prompt()
    const scelta = await evento.userChoice
    if (scelta.outcome === 'accepted') setNascosto(true)
    setEvento(null)
  }

  if (nascosto || !pronto) return null

  return (
    <section
      aria-labelledby="titolo-installa"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] motion-safe:animate-[sali_300ms_ease-out]"
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <Logo />
          <div className="min-w-0 flex-1">
            <h2 id="titolo-installa" className="font-semibold">
              Installa l'app
            </h2>
            <p className="text-sm text-slate-500">Metti WhosNext nella schermata Home</p>
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

        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-300">
          {VANTAGGI.map(({ icona: Icona, testo }) => (
            <li key={testo} className="flex items-center gap-1.5">
              <Icona aria-hidden className="size-3.5 text-accento dark:text-blue-300" />
              {testo}
            </li>
          ))}
        </ul>

        <div className="mt-4 text-sm">
          {evento ? (
            <div className="flex flex-wrap gap-2">
              <Bottone icona={Download} onClick={installa}>
                Installa
              </Bottone>
              <Bottone variante="tenue" onClick={nonOra}>
                Non ora
              </Bottone>
            </div>
          ) : telefono === 'iphone' ? (
            <p className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
              Tocca <Share aria-label="Condividi" className="inline size-4 align-text-bottom text-accento" />{' '}
              <strong>Condividi</strong> (o il menu <strong>…</strong>), poi <strong>Aggiungi alla schermata Home</strong>.
            </p>
          ) : telefono === 'app-social' ? (
            <p className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
              Da qui non si può installare: apri il link in <strong>Chrome</strong> o <strong>Safari</strong> (menu in alto,
              "Apri nel browser").
            </p>
          ) : (
            <p className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
              Tocca <EllipsisVertical aria-label="il menu" className="inline size-4 align-text-bottom text-accento" /> in alto a
              destra, poi <strong>Installa app</strong> (o <strong>Aggiungi a schermata Home</strong>).
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
