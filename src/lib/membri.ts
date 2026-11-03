import type { Membro, Ruolo } from './tipi'

const PRIORITA: Record<Ruolo, number> = { capo: 0, vice: 1, studente: 2, docente: 3 }

function confrontaNomi(a: Membro, b: Membro): number {
  return a.nome.localeCompare(b.nome, 'it', { sensitivity: 'base' })
}

/**
 * Divide i membri in studenti (capo, poi vice, poi gli altri in ordine alfabetico)
 * e docenti (in ordine alfabetico). I docenti non fanno parte delle liste delle interrogazioni.
 */
export function dividiMembri(membri: Membro[]): { studenti: Membro[]; docenti: Membro[] } {
  const studenti = membri
    .filter((m) => m.ruolo !== 'docente')
    .sort((a, b) => PRIORITA[a.ruolo] - PRIORITA[b.ruolo] || confrontaNomi(a, b))
  const docenti = membri.filter((m) => m.ruolo === 'docente').sort(confrontaNomi)
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
