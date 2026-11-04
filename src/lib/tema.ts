/** Tema chiaro, scuro o automatico (come il telefono). Si salva solo su questo dispositivo. */
import { useSyncExternalStore } from 'react'

export type Tema = 'automatico' | 'chiaro' | 'scuro'

const CHIAVE = 'tema'
const ascoltatori = new Set<() => void>()

export function leggiTema(): Tema {
  try {
    const t = localStorage.getItem(CHIAVE)
    return t === 'chiaro' || t === 'scuro' ? t : 'automatico'
  } catch {
    return 'automatico'
  }
}

function sistemaScuro(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function applica() {
  const t = leggiTema()
  const scuro = t === 'scuro' || (t === 'automatico' && sistemaScuro())
  document.documentElement.dataset.tema = scuro ? 'scuro' : 'chiaro'
}

export function impostaTema(t: Tema) {
  try {
    if (t === 'automatico') localStorage.removeItem(CHIAVE)
    else localStorage.setItem(CHIAVE, t)
  } catch {
    /* resta solo per questa visita */
  }
  applica()
  ascoltatori.forEach((f) => f())
}

export function avviaTema() {
  applica()
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applica)
}

export function useTema(): Tema {
  return useSyncExternalStore(
    (f) => {
      ascoltatori.add(f)
      return () => ascoltatori.delete(f)
    },
    leggiTema,
  )
}
