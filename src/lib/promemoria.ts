/**
 * Promemoria "sei interrogato": quanti giorni prima arriva (la sera, dalle 18). Lo sceglie lo studente
 * nelle Impostazioni e vale per tutte le interrogazioni. Logica pura, la stessa per il sito e per il server.
 */

/** Si può scegliere uno o più di questi (giorni di calendario prima dell'interrogazione). */
export const GIORNI_PROMEMORIA: readonly number[] = [1, 2, 3]
/** Di base: solo la sera prima. */
export const PROMEMORIA_DEFAULT: readonly number[] = [1]

/** I giorni scelti, in ordine e senza doppioni; un valore non valido vale quello di base. Vuoto = nessun promemoria. */
export function giorniPromemoria(v: unknown): number[] {
  if (!Array.isArray(v)) return [...PROMEMORIA_DEFAULT]
  return [...new Set(v.filter((n): n is number => typeof n === 'number' && GIORNI_PROMEMORIA.includes(n)))].sort((a, b) => a - b)
}

/** "1 giorno prima", "2 giorni prima"… */
export function testoPromemoria(n: number): string {
  return n === 1 ? '1 giorno prima' : `${n} giorni prima`
}
