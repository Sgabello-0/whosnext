import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth, db, DOMINI } from './firebase'
import { verificaAccesso, type EsitoAccesso } from './domain'
import { nomeVisualizzato } from './membri'
import { salvaProfiloUtente } from './classi'
import type { Profilo } from './tipi'

type StatoAuth = {
  /** false finché Firebase non ha detto se c'è un utente collegato */
  pronto: boolean
  utente: User | null
  esito: EsitoAccesso | null
  /** presente solo se l'utente è ammesso */
  profilo: Profilo | null
  esci: () => Promise<void>
}

const ContestoAuth = createContext<StatoAuth | null>(null)

export function profiloDa(utente: User, esito: EsitoAccesso): Profilo | null {
  if (!esito.ammesso || !utente.email) return null
  return {
    uid: utente.uid,
    nome: nomeVisualizzato(utente.displayName, utente.email),
    email: utente.email,
    foto: utente.photoURL,
    tipo: esito.tipo,
  }
}

export function ProviderAuth({ children }: { children: ReactNode }) {
  const [stato, setStato] = useState<Omit<StatoAuth, 'esci'>>({ pronto: !auth, utente: null, esito: null, profilo: null })

  useEffect(() => {
    if (!auth) return
    return onAuthStateChanged(auth, (utente) => {
      if (!utente) {
        setStato({ pronto: true, utente: null, esito: null, profilo: null })
        return
      }
      const esito = verificaAccesso({ email: utente.email, emailVerified: utente.emailVerified }, DOMINI)
      const profilo = profiloDa(utente, esito)
      setStato({ pronto: true, utente, esito, profilo })
      // Aggiorna nome e foto nel database: se non riesce il sito funziona lo stesso.
      if (profilo && db) salvaProfiloUtente(db, profilo).catch((e) => console.warn('Profilo non salvato', e))
    })
  }, [])

  const esci = async () => {
    if (auth) await signOut(auth)
  }

  return <ContestoAuth.Provider value={{ ...stato, esci }}>{children}</ContestoAuth.Provider>
}

export function useAuth(): StatoAuth {
  const c = useContext(ContestoAuth)
  if (!c) throw new Error('useAuth va usato dentro <ProviderAuth>')
  return c
}

/** Profilo dell'utente ammesso: da usare solo nelle pagine dietro il login. */
export function useProfilo(): Profilo {
  const { profilo } = useAuth()
  if (!profilo) throw new Error('Nessun utente ammesso')
  return profilo
}
