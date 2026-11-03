/**
 * Controlli sul dominio email della scuola.
 * Logica pura: la stessa regola va replicata in firestore.rules.
 */

export const DOMINIO_SCUOLA_DEFAULT = 'studenti.ittsrimini.edu.it'

/** Restituisce il dominio (minuscolo) di un indirizzo email valido, altrimenti null. */
export function dominioEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const pulita = email.trim().toLowerCase()
  const parti = pulita.split('@')
  if (parti.length !== 2) return null
  const [locale, dominio] = parti as [string, string]
  if (!locale || !dominio || /\s/.test(pulita)) return null
  return dominio
}

/** true se l'email appartiene esattamente al dominio indicato (niente sottodomini o suffissi). */
export function emailDelDominio(email: string | null | undefined, dominio: string): boolean {
  const d = dominioEmail(email)
  return d !== null && d === dominio.trim().toLowerCase()
}

export type EsitoAccesso =
  | { ammesso: true }
  | { ammesso: false; motivo: 'email-mancante' | 'email-non-verificata' | 'dominio-errato' }

/** Decide se un utente autenticato può usare il sito. */
export function verificaAccesso(
  utente: { email: string | null; emailVerified: boolean },
  dominio: string,
): EsitoAccesso {
  if (!utente.email) return { ammesso: false, motivo: 'email-mancante' }
  if (!emailDelDominio(utente.email, dominio)) return { ammesso: false, motivo: 'dominio-errato' }
  if (!utente.emailVerified) return { ammesso: false, motivo: 'email-non-verificata' }
  return { ammesso: true }
}
