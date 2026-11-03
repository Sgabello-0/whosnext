import type { Scelta } from './generateList'

export const ETICHETTA_SCELTA: Record<Scelta, string> = {
  inizio: 'Inizio',
  meta: 'Metà',
  fine: 'Fine',
  indifferente: 'Non mi interessa',
  posizione: 'Posizione esatta',
}

export const SPIEGAZIONE_SCELTA: Record<Exclude<Scelta, 'posizione'>, string> = {
  inizio: 'tra i primi',
  meta: 'a metà lista',
  fine: 'tra gli ultimi',
  indifferente: 'un posto qualsiasi',
}
