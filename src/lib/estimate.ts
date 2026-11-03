/**
 * Stima della data d'interrogazione (vedi PIANO.md, "Stima della data").
 *
 * k = posizione tra i non ancora interrogati (da 0); lezioneIndex = floor(k / perLezione).
 */
import { formattaGiorno, haLezione, prossimeLezioni, type Calendario, type DataISO } from './calendar'

export type Stima =
  /** "Stimata: Martedì 03/11" */
  | { tipo: 'data'; data: DataISO }
  /** "Tra 1 lezione", "Tra 2 lezioni" (manca il calendario dei giorni) */
  | { tipo: 'lezioni'; tra: number }
  /** manca il numero per lezione */
  | { tipo: 'non-disponibile'; prossimaLezione: DataISO | null }
  /** la data stimata cade dopo la fine dell'anno */
  | { tipo: 'oltre-fine-anno' }

export function stimaInterrogazione(opz: {
  /** posizione tra i non ancora interrogati, da 0 */
  k: number
  perLezione: number | null
  giorni: readonly number[]
  subjectId: string | null
  cal: Calendario
  /** primo giorno da considerare (di solito oggi) */
  da: DataISO
  /**
   * quanti sono già stati segnati come interrogati nel giorno `da`:
   * se quel giorno c'è lezione, hanno già occupato dei posti
   */
  giaInterrogatiDa?: number
}): Stima {
  const { perLezione, giorni, subjectId, cal, da } = opz
  const conGiorni = giorni.length > 0
  const lezioneOggi = haLezione(da, giorni, subjectId, cal)
  const k = opz.k + (lezioneOggi ? (opz.giaInterrogatiDa ?? 0) : 0)

  if (!perLezione || perLezione < 1) {
    const [prossima] = conGiorni ? prossimeLezioni({ giorni, subjectId, cal, da, quante: 1 }) : []
    return { tipo: 'non-disponibile', prossimaLezione: prossima ?? null }
  }

  const lezioneIndex = Math.floor(Math.max(0, k) / perLezione)
  if (!conGiorni) return { tipo: 'lezioni', tra: lezioneIndex + 1 }

  const lezioni = prossimeLezioni({ giorni, subjectId, cal, da, quante: lezioneIndex + 1 })
  const data = lezioni[lezioneIndex]
  return data ? { tipo: 'data', data } : { tipo: 'oltre-fine-anno' }
}

/** Testo da mostrare per una stima. */
export function testoStima(s: Stima): string {
  switch (s.tipo) {
    case 'data':
      return `Stimata: ${formattaGiorno(s.data)}`
    case 'lezioni':
      return s.tra === 1 ? 'Tra 1 lezione' : `Tra ${s.tra} lezioni`
    case 'non-disponibile':
      return s.prossimaLezione
        ? `Stima non disponibile · Prossima lezione: ${formattaGiorno(s.prossimaLezione)}`
        : 'Stima non disponibile'
    case 'oltre-fine-anno':
      return "Oltre la fine dell'anno"
  }
}
