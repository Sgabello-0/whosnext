/**
 * "Non ci sarò" e cambi di posto: chi si sposta e dove. Logica pura, la stessa per il sito e per il server.
 */
import { aggiungiGiorni, primoGiornoUtile, prossimeLezioni, type DataISO } from './calendar'
import { programmaLista, type DatiProgramma, type Programma, type RigaProgramma } from './programma'

export const GIORNI_ASSENZA_DEFAULT = 2
export const GIORNI_ASSENZA_MAX = 30

/** Quanti giorni prima dell'interrogazione si può dire "non ci sarò" (valore della classe, o quello di base). */
export function giorniAssenza(v: unknown): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= GIORNI_ASSENZA_MAX ? v : GIORNI_ASSENZA_DEFAULT
}

/** Con 2 giorni e interrogazione il 12 si può dire fino al 10: dall'11 è in ritardo. */
export function assenzaInRitardo(oggi: DataISO, data: DataISO, giorni: number): boolean {
  return oggi > aggiungiGiorni(data, -giorni)
}

/**
 * Le date per cui si può dire "non ci sarò": quella prevista per lo studente;
 * se la lista non ha date (manca il numero per lezione), le prossime lezioni.
 */
export function dateAssenza(o: DatiProgramma, uid: string, quante = 12): DataISO[] {
  const s = programmaLista(o).stime.get(uid)
  if (s?.tipo === 'data') return [s.data]
  if (s?.tipo !== 'non-disponibile') return []
  return prossimeLezioni({ giorni: o.giorni, subjectId: o.subjectId, cal: o.cal, da: primoGiornoUtile(o.adesso, o.cal, o.creata), quante })
}

/** La prima lezione dopo `assente` con un posto non già preso dalle date fisse degli altri. null se non ce ne sono. */
export function primaDataLibera(o: DatiProgramma, uid: string, assente: DataISO): DataISO | null {
  const { stime } = programmaLista(o)
  const occupati = new Map<DataISO, number>()
  for (const u of Object.keys(o.fissi ?? {})) {
    const s = stime.get(u)
    if (u !== uid && s?.tipo === 'data') occupati.set(s.data, (occupati.get(s.data) ?? 0) + 1)
  }
  const lezioni = prossimeLezioni({ giorni: o.giorni, subjectId: o.subjectId, cal: o.cal, da: aggiungiGiorni(assente, 1), quante: 366 })
  return lezioni.find((d) => !o.perLezione || (occupati.get(d) ?? 0) < o.perLezione) ?? null
}

const posto = (r: RigaProgramma) => `${r.numero}|${r.fissa ?? ''}|${r.stima?.tipo === 'data' ? r.stima.data : ''}`

/**
 * Chi avvisare dopo una modifica della lista (mai chi l'ha fatta, mai chi è già stato interrogato).
 * - "Non ci sarò": chi era dopo lo studente e ora è prima di lui.
 * - Ogni altra modifica: chi ha cambiato numero o data, compreso chi è entrato o uscito dalla lista.
 */
export function chiSiSposta(o: { tipo: string; uid?: string; chi: string; prima: Programma; dopo: Programma }): string[] {
  if (o.tipo === 'assenza') {
    const indici = new Map(o.prima.righe.map((r, i) => [r.uid, i]))
    const eraA = indici.get(o.uid ?? '')
    const oraA = o.dopo.righe.findIndex((r) => r.uid === o.uid)
    if (eraA === undefined || oraA < 0) return []
    return o.dopo.righe
      .slice(0, oraA)
      .filter((r) => !r.interrogato && r.uid !== o.chi && (indici.get(r.uid) ?? -1) > eraA)
      .map((r) => r.uid)
  }
  const prima = new Map(o.prima.righe.map((r) => [r.uid, r]))
  const dopo = new Map(o.dopo.righe.map((r) => [r.uid, r]))
  return [...new Set([...prima.keys(), ...dopo.keys()])].filter((u) => {
    const p = prima.get(u)
    const d = dopo.get(u)
    if (u === o.chi || p?.interrogato || d?.interrogato) return false
    return !p || !d || posto(p) !== posto(d)
  })
}
