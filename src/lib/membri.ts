import type { Membro, Ruolo } from './tipi'

const PRIORITA: Record<Ruolo, number> = { capo: 0, vice: 1, studente: 2, docente: 3 }

const PARTICELLE = new Set(['de', 'di', 'del', 'dello', 'della', 'dei', 'degli', 'delle', 'da', 'dal', 'dalla', 'lo', 'la', 'li', 'le', 'van', 'von'])

/** "Cognome Nome" per ordinare: il cognome è l'ultima parola, con le particelle che lo precedono ("Mario De Rossi" → De Rossi). */
export function chiaveCognome(nome: string): string {
  const parole = nome.trim().split(/\s+/)
  let inizio = parole.length - 1
  while (inizio > 1 && PARTICELLE.has(parole[inizio - 1]!.toLowerCase())) inizio--
  return [...parole.slice(inizio), ...parole.slice(0, inizio)].join(' ')
}

/** Confronta due nomi completi per cognome, poi per nome. */
export function confrontaCognomi(a: string, b: string): number {
  return chiaveCognome(a).localeCompare(chiaveCognome(b), 'it', { sensitivity: 'base' })
}

/**
 * Divide i membri in studenti (capo, poi vice, poi gli altri per cognome) e docenti (per cognome).
 * I docenti non fanno parte delle liste delle interrogazioni.
 */
export function dividiMembri(membri: Membro[]): { studenti: Membro[]; docenti: Membro[] } {
  const perCognome = (a: Membro, b: Membro) => confrontaCognomi(a.nome, b.nome)
  const studenti = membri.filter((m) => m.ruolo !== 'docente').sort((a, b) => PRIORITA[a.ruolo] - PRIORITA[b.ruolo] || perCognome(a, b))
  const docenti = membri.filter((m) => m.ruolo === 'docente').sort(perCognome)
  return { studenti, docenti }
}

/** Chi può modificare le liste: capo, vice e docenti con permesso. */
export function puoModificareListe(m: Pick<Membro, 'ruolo' | 'permessoModifica'> | null | undefined): boolean {
  if (!m) return false
  return m.ruolo === 'capo' || m.ruolo === 'vice' || (m.ruolo === 'docente' && m.permessoModifica)
}

/** Chi gestisce i badge DSA/BES: solo capo e vice. */
export function puoGestireDSA(m: Pick<Membro, 'ruolo'> | null | undefined): boolean {
  return m?.ruolo === 'capo' || m?.ruolo === 'vice'
}

export const ETICHETTA_RUOLO: Record<Ruolo, string> = {
  capo: 'Capoclasse',
  vice: 'Vice',
  studente: 'Studente',
  docente: 'Docente',
}

/** Nome da mostrare a partire dai dati di Google: il nome, altrimenti la parte prima della @. */
export function nomeVisualizzato(nomeGoogle: string | null | undefined, email: string): string {
  const nome = (nomeGoogle ?? '').trim() || email.split('@')[0] || email
  return nome.slice(0, 100)
}
