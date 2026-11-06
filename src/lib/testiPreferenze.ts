import { formattaGiorno } from './calendar'
import type { Scelta } from './generateList'

/** "inizio", "metà", … o "la data di martedì 10/11" */
export function descriviScelta(s: { scelta: Scelta; dataDSA?: string | null }): string {
  if (s.scelta === 'data') return s.dataDSA ? `la data di ${formattaGiorno(s.dataDSA).toLowerCase()}` : 'una data'
  return ETICHETTA_SCELTA[s.scelta].toLowerCase()
}

export const ETICHETTA_SCELTA: Record<Scelta, string> = {
  inizio: 'Inizio',
  meta: 'Metà',
  fine: 'Fine',
  indifferente: 'Non mi interessa',
  data: 'Data scelta',
}

export const SPIEGAZIONE_SCELTA: Record<Exclude<Scelta, 'data'>, string> = {
  inizio: 'tra i primi',
  meta: 'a metà lista',
  fine: 'tra gli ultimi',
  indifferente: 'un posto qualsiasi',
}
