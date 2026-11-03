import { useEffect, useState } from 'react'
import { Bottone, Scheda } from './ui'
import { Download, Smartphone } from 'lucide-react'

/** Evento di Chrome/Android per proporre l'installazione (non è nei tipi standard). */
type EventoInstallazione = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const CHIAVE = 'installa-app-nascosto'

function giaInstallata(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

function leggiNascosto(): boolean {
  try {
    return localStorage.getItem(CHIAVE) === '1'
  } catch {
    return false
  }
}

/** Suggerisce di installare il sito come app (icona sulla schermata Home). */
export function InstallaApp() {
  const [evento, setEvento] = useState<EventoInstallazione | null>(null)
  const [nascosto, setNascosto] = useState(() => leggiNascosto() || giaInstallata())
  const iPhone = /iPhone|iPad|iPod/.test(navigator.userAgent)

  useEffect(() => {
    const proponi = (e: Event) => {
      e.preventDefault()
      setEvento(e as EventoInstallazione)
    }
    const installata = () => setNascosto(true)
    window.addEventListener('beforeinstallprompt', proponi)
    window.addEventListener('appinstalled', installata)
    return () => {
      window.removeEventListener('beforeinstallprompt', proponi)
      window.removeEventListener('appinstalled', installata)
    }
  }, [])

  function nascondi() {
    try {
      localStorage.setItem(CHIAVE, '1')
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

  if (nascosto || (!evento && !iPhone)) return null

  return (
    <Scheda
      titolo="Installa l'app"
      icona={Smartphone}
      azioni={
        <button type="button" onClick={nascondi} className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
          No, grazie
        </button>
      }
    >
      {evento ? (
        <div className="space-y-3 text-sm">
          <p>Aggiungi WhosNext alla schermata Home: si apre come un'app, più in fretta.</p>
          <Bottone onClick={installa} icona={Download}>
            Installa
          </Bottone>
        </div>
      ) : (
        <p className="text-sm">
          Su iPhone: tocca <strong>Condividi</strong> (il quadrato con la freccia in su) e poi{' '}
          <strong>Aggiungi alla schermata Home</strong>. Si aprirà come un'app.
        </p>
      )}
    </Scheda>
  )
}
