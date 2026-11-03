/**
 * Codici d'invito delle classi: 6 caratteri, senza quelli facili da confondere
 * (niente 0/O, 1/I/L), così si possono dettare a voce o copiare dalla lavagna.
 */

export const ALFABETO_CODICE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const LUNGHEZZA_CODICE = 6

/** Genera un codice casuale. `casuale` restituisce interi casuali (iniettabile nei test). */
export function generaCodice(casuale: (n: number) => Uint32Array = valoriCasuali): string {
  const valori = casuale(LUNGHEZZA_CODICE)
  let codice = ''
  for (let i = 0; i < LUNGHEZZA_CODICE; i++) {
    codice += ALFABETO_CODICE[(valori[i] ?? 0) % ALFABETO_CODICE.length]
  }
  return codice
}

function valoriCasuali(n: number): Uint32Array {
  return crypto.getRandomValues(new Uint32Array(n))
}

/**
 * Normalizza quello che l'utente digita: maiuscole, niente spazi o trattini.
 * Restituisce null se il risultato non è un codice valido
 * (lunghezza sbagliata o caratteri fuori dall'alfabeto, come 0, O, 1, I, L).
 */
export function normalizzaCodice(input: string): string | null {
  const pulito = input.toUpperCase().replace(/[\s\-_.]/g, '')
  if (pulito.length !== LUNGHEZZA_CODICE) return null
  for (const ch of pulito) if (!ALFABETO_CODICE.includes(ch)) return null
  return pulito
}

/** Formato leggibile: "ABC-DEF". */
export function formattaCodice(codice: string): string {
  return codice.length === LUNGHEZZA_CODICE ? `${codice.slice(0, 3)}-${codice.slice(3)}` : codice
}

/** Estrae il codice da un link d'invito (…/unisciti/ABCDEF) oppure da un codice digitato. */
export function codiceDaTesto(testo: string): string | null {
  const daLink = testo.match(/\/unisciti\/([A-Za-z0-9-]+)/)
  return normalizzaCodice(daLink ? (daLink[1] ?? '') : testo)
}
