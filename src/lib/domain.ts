/**
 * Controlli sul dominio email della scuola.
 * Logica pura: la stessa regola va replicata in firestore.rules.
 *
 * Il tipo di account (studente o docente) dipende SOLO dal dominio dell'email
 * verificata da Google: nessuno può sceglierlo da sé.
 */

export type DominiScuola = {
  /** dominio degli studenti, es. studenti.ittsrimini.edu.it */
  studenti: string
  /** dominio dei docenti, es. ittsrimini.edu.it */
  docenti: string
}

export const DOMINI_DEFAULT: DominiScuola = {
  studenti: 'studenti.ittsrimini.edu.it',
  docenti: 'ittsrimini.edu.it',
}

export type TipoAccount = 'studente' | 'docente'

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

/** Tipo di account in base al dominio esatto dell'email, o null se non è della scuola. */
export function tipoAccount(email: string | null | undefined, domini: DominiScuola): TipoAccount | null {
  if (emailDelDominio(email, domini.studenti)) return 'studente'
  if (emailDelDominio(email, domini.docenti)) return 'docente'
  return null
}

export type EsitoAccesso =
  | { ammesso: true; tipo: TipoAccount }
  | { ammesso: false; motivo: 'email-mancante' | 'email-non-verificata' | 'dominio-errato' }

/** Decide se un utente autenticato può usare il sito, e con quale tipo di account. */
export function verificaAccesso(
  utente: { email: string | null; emailVerified: boolean },
  domini: DominiScuola,
): EsitoAccesso {
  if (!utente.email) return { ammesso: false, motivo: 'email-mancante' }
  const tipo = tipoAccount(utente.email, domini)
  if (!tipo) return { ammesso: false, motivo: 'dominio-errato' }
  if (!utente.emailVerified) return { ammesso: false, motivo: 'email-non-verificata' }
  return { ammesso: true, tipo }
}
