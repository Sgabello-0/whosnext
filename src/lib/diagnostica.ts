import type { User } from 'firebase/auth'
import { dominioEmail, type EsitoAccesso } from './domain'
import { DOMINI } from './firebase'

/** Riepilogo tecnico da incollare in chat quando qualcosa non va (niente token né password). */
export function datiDiagnostica(info: { utente?: User | null; esito?: EsitoAccesso | null; errore?: string | null }) {
  return {
    quando: new Date().toISOString(),
    sito: location.origin,
    browser: navigator.userAgent,
    dominiAttesi: DOMINI,
    dominioEmail: dominioEmail(info.utente?.email),
    emailVerificata: info.utente?.emailVerified ?? null,
    esito: info.esito ?? null,
    errore: info.errore ?? null,
  }
}

export async function copiaTesto(testo: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(testo)
    return true
  } catch {
    return false
  }
}
