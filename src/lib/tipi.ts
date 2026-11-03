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
