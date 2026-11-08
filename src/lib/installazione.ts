/**
 * Installazione come app (PWA): l'evento di Chrome/Android si ascolta da subito e si conserva,
 * così sia l'invito in basso sia le Impostazioni possono usarlo.
 */
import { useSyncExternalStore } from 'react'

/** Evento di Chrome/Android per proporre l'installazione (non è nei tipi standard). */
type EventoInstallazione = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

export type Telefono = 'android' | 'samsung' | 'iphone' | 'app-social' | null

let evento: EventoInstallazione | null = null
let installata = false
let stato = { proponibile: false, installata: false }
const ascoltatori = new Set<() => void>()

function aggiorna() {
  stato = { proponibile: !!evento, installata }
  ascoltatori.forEach((f) => f())
}

export function tipoTelefono(ua: string = navigator.userAgent): Telefono {
  // dentro Instagram, Facebook, TikTok… non si può installare: va aperto nel browser
  if (/Instagram|FBAN|FBAV|TikTok|Line\//i.test(ua)) return 'app-social'
  // da Samsung Internet Play Protect blocca l'app creata dal browser ("App non sicura"): si installa da Chrome
  if (/SamsungBrowser/i.test(ua)) return 'samsung'
  if (/iPhone|iPad|iPod/.test(ua)) return 'iphone'
  if (/Android/.test(ua)) return 'android'
  return null
}

export function avviaInstallazione() {
  installata =
    window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    evento = e as EventoInstallazione
    aggiorna()
  })
  window.addEventListener('appinstalled', () => {
    installata = true
    evento = null
    aggiorna()
  })
  aggiorna()
}

/** Apre la finestra di installazione del browser (solo dopo un tocco dell'utente). true se installata. */
export async function installa(): Promise<boolean> {
  if (!evento) return false
  const e = evento
  await e.prompt()
  const scelta = await e.userChoice
  evento = null
  if (scelta.outcome === 'accepted') installata = true
  aggiorna()
  return scelta.outcome === 'accepted'
}

export function useInstallazione(): { proponibile: boolean; installata: boolean } {
  return useSyncExternalStore(
    (f) => {
      ascoltatori.add(f)
      return () => ascoltatori.delete(f)
    },
    () => stato,
  )
}
