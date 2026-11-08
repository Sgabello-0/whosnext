/** true su schermi da computer (da 1024 px, il "lg" di Tailwind): le pagine diventano a dashboard. */
import { useSyncExternalStore } from 'react'

const QUERY = '(min-width: 1024px)'

function iscriviti(avvisa: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const m = window.matchMedia(QUERY)
  m.addEventListener('change', avvisa)
  return () => m.removeEventListener('change', avvisa)
}

function leggi(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches
}

export function useDesktop(): boolean {
  return useSyncExternalStore(iscriviti, leggi, () => false)
}
