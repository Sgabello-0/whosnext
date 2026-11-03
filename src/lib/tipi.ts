import type { Timestamp } from 'firebase/firestore'
import type { TipoAccount } from './domain'

export type Ruolo = 'capo' | 'vice' | 'studente' | 'docente'

/** I dati dell'utente autenticato che servono per scrivere su Firestore. */
export type Profilo = {
  uid: string
  nome: string
  email: string
  foto: string | null
  tipo: TipoAccount
}

export type Classe = {
  id: string
  nome: string
  codiceInvito: string
  capoclasseUid: string
  creato?: Timestamp
}

export type Membro = {
  uid: string
  nome: string
  email: string
  foto: string | null
  ruolo: Ruolo
  /** solo docenti: il capoclasse ha dato il permesso di modifica */
  permessoModifica: boolean
  /** solo docenti: ha chiesto il permesso e aspetta la risposta */
  richiestaPermesso: boolean
  codiceUsato: string
  entrato?: Timestamp
}

export type Invito = {
  classId: string
  nomeClasse: string
}

export type ImpostazioniUtente = {
  autoRifiutaScambi: boolean
  notificheEmail: boolean
  notifichePush: boolean
}

export const IMPOSTAZIONI_DEFAULT: ImpostazioniUtente = {
  autoRifiutaScambi: false,
  notificheEmail: true,
  notifichePush: true,
}

export type Materia = {
  nome: string
  /** giorni di lezione: 0 = lunedì … 5 = sabato */
  orario: number[]
  creato?: Timestamp
}

export type StatoInterrogazione = 'raccolta' | 'lista' | 'conclusa'

export type Interrogazione = {
  nome: string
  descrizione: string
  /** giorni in cui si interroga (di default quelli della materia); vuoto = nessuna data stimabile */
  giorni: number[]
  /** quanti studenti per lezione; null = non si sa */
  perLezione: number | null
  scadenzaPreferenze: Timestamp
  stato: StatoInterrogazione
  creato?: Timestamp
  creatoDa: string
  aggiornato?: Timestamp
}

export type DocPreferenza = {
  scelta: import('./generateList').Scelta
  posizioneDSA: number | null
  aggiornato?: Timestamp
}

export type DocLista = {
  /** uid in ordine di interrogazione */
  ordine: string[]
  /** uid → data (AAAA-MM-GG) in cui è stato interrogato */
  interrogati: Record<string, string>
  generata?: Timestamp
  generataDa: string
}

export type DocRapporto = import('./generateList').Rapporto & { generata?: Timestamp }

export type DocSegnalazione = {
  /** giorno in cui dice di essere stato interrogato (AAAA-MM-GG) */
  data: string
  quando?: Timestamp
}
