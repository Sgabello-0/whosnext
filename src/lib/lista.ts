/**
 * Logica pura sulla lista generata: chi manca, proposte per la lezione, spostamenti.
 */
import { aggiungiGiorni, haLezione, type Calendario, type DataISO } from './calendar'

/** uid ancora da interrogare, nell'ordine della lista. */
export function nonInterrogati(ordine: readonly string[], interrogati: Readonly<Record<string, string>>): string[] {
  return ordine.filter((u) => !interrogati[u])
}

/**
 * "Interrogati previsti" nella lezione del giorno `data`: prima chi ha la data fissa fino a quel giorno
 * (DSA/BES, non ancora interrogati), poi i primi non interrogati della lista nei posti rimasti.
 * Senza numero per lezione si propone un solo posto.
 */
export function propostaLezione(
  ordine: readonly string[],
  interrogati: Readonly<Record<string, string>>,
  perLezione: number | null,
  fissi: Readonly<Record<string, string>> = {},
  data: DataISO | null = null,
): string[] {
  const conData = Object.entries(fissi)
    .filter(([u, d]) => !interrogati[u] && data !== null && d <= data)
    .sort(([ua, a], [ub, b]) => a.localeCompare(b) || ua.localeCompare(ub))
    .map(([u]) => u)
  const posti = Math.max(perLezione ?? 1, 1)
  const altri = Math.max(conData.length > 0 ? 0 : 1, posti - conData.length)
  return [...conData, ...nonInterrogati(ordine, interrogati).filter((u) => !(u in fissi)).slice(0, altri)]
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

/** true quando tutti sono stati interrogati (anche chi ha la data fissa). */
export function tuttiInterrogati(
  ordine: readonly string[],
  interrogati: Readonly<Record<string, string>>,
  fissi: Readonly<Record<string, string>> = {},
): boolean {
  const tutti = [...ordine, ...Object.keys(fissi)]
  return tutti.length > 0 && tutti.every((u) => !!interrogati[u])
}

/** Manda una persona in fondo alla lista. */
export function mandaInFondo<T>(elenco: readonly T[], i: number): T[] {
  return sposta(elenco, i, elenco.length - 1)
}

/**
 * Chi è stato spostato davvero passando da `vecchio` a `nuovo` (stesse persone):
 * quelli fuori dalla sottosequenza crescente più lunga delle vecchie posizioni.
 * Così trascinando un nome si registra solo quello, non tutti quelli scalati di un posto.
 * Posizioni da 1.
 */
export function spostati(vecchio: readonly string[], nuovo: readonly string[]): { uid: string; da: number; a: number }[] {
  const posVecchia = new Map(vecchio.map((u, i) => [u, i]))
  const seq = nuovo.map((u) => posVecchia.get(u) ?? -1)
  // Sottosequenza crescente più lunga (O(n²): le classi sono piccole)
  const lunghezza = seq.map(() => 1)
  const precedente = seq.map(() => -1)
  for (let i = 0; i < seq.length; i++) {
    for (let j = 0; j < i; j++) {
      if (seq[j]! < seq[i]! && lunghezza[j]! + 1 > lunghezza[i]!) {
        lunghezza[i] = lunghezza[j]! + 1
        precedente[i] = j
      }
    }
  }
  let fine = -1
  for (let i = 0; i < seq.length; i++) if (fine === -1 || lunghezza[i]! > lunghezza[fine]!) fine = i
  const fermi = new Set<number>()
  for (let i = fine; i !== -1; i = precedente[i]!) fermi.add(i)
  return nuovo.flatMap((uid, i) =>
    fermi.has(i) ? [] : [{ uid, da: (posVecchia.get(uid) ?? -1) + 1, a: i + 1 }],
  )
}
