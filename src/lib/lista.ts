/**
 * Logica pura sulla lista generata: chi manca, proposte per la lezione, spostamenti.
 */
import { aggiungiGiorni, haLezione, type Calendario, type DataISO } from './calendar'

/** uid ancora da interrogare, nell'ordine della lista. */
export function nonInterrogati(ordine: readonly string[], interrogati: Readonly<Record<string, string>>): string[] {
  return ordine.filter((u) => !interrogati[u])
}

/**
 * "Probabilmente interrogati" in una lezione: i primi N non ancora interrogati.
 * Senza numero per lezione si propone solo il primo.
 */
export function propostaLezione(
  ordine: readonly string[],
  interrogati: Readonly<Record<string, string>>,
  perLezione: number | null,
): string[] {
  return nonInterrogati(ordine, interrogati).slice(0, Math.max(1, perLezione ?? 1))
}

/** Sposta un elemento da una posizione a un'altra (come trascinandolo). */
export function sposta<T>(elenco: readonly T[], da: number, a: number): T[] {
  const copia = [...elenco]
  if (da < 0 || da >= copia.length || a < 0 || a >= copia.length || da === a) return copia
  const [el] = copia.splice(da, 1)
  copia.splice(a, 0, el as T)
  return copia
}

/** true se `b` contiene esattamente gli stessi elementi di `a` (in un ordine qualsiasi). */
export function stessiElementi(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const s = new Set(a)
  return s.size === a.length && b.every((x) => s.has(x)) && new Set(b).size === b.length
}

/**
 * L'ultima lezione della materia fino a oggi compreso (per proporre la data quando si segnano
 * gli interrogati), cercando indietro fino a 60 giorni. null se non ce ne sono.
 */
export function ultimaLezione(
  giorni: readonly number[],
  subjectId: string,
  cal: Calendario,
  oggi: DataISO,
): DataISO | null {
  for (let i = 0; i <= 60; i++) {
    const d = aggiungiGiorni(oggi, -i)
    if (haLezione(d, giorni, subjectId, cal)) return d
  }
  return null
}

/** true quando tutti sono stati interrogati. */
export function tuttiInterrogati(ordine: readonly string[], interrogati: Readonly<Record<string, string>>): boolean {
  return ordine.length > 0 && ordine.every((u) => !!interrogati[u])
}
