import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import type { Firestore } from 'firebase/firestore'
import type { Profilo } from '../../src/lib/tipi'

export const PROJECT_ID = 'demo-whosnext'

export function avviaAmbiente(): Promise<RulesTestEnvironment> {
  return initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
}

/** Utenti di prova. */
export const UTENTI = {
  anna: { uid: 'anna', nome: 'Anna', email: 'anna.verdi@studenti.ittsrimini.edu.it', foto: null, tipo: 'studente' },
  bruno: { uid: 'bruno', nome: 'Bruno', email: 'bruno.neri@studenti.ittsrimini.edu.it', foto: null, tipo: 'studente' },
  carla: { uid: 'carla', nome: 'Carla', email: 'carla.blu@studenti.ittsrimini.edu.it', foto: null, tipo: 'studente' },
  rossi: { uid: 'rossi', nome: 'Prof. Rossi', email: 'mario.rossi@ittsrimini.edu.it', foto: null, tipo: 'docente' },
  bianchi: { uid: 'bianchi', nome: 'Prof. Bianchi', email: 'laura.bianchi@ittsrimini.edu.it', foto: null, tipo: 'docente' },
} satisfies Record<string, Profilo>

/** Database visto da un utente (email verificata, salvo indicazione contraria). */
export function dbDi(env: RulesTestEnvironment, p: { uid: string; email: string }, emailVerificata = true): Firestore {
  return env.authenticatedContext(p.uid, { email: p.email, email_verified: emailVerificata }).firestore() as unknown as Firestore
}

/** Profilo finto per utenti esterni alla scuola. */
export function esterno(uid: string, email: string): Profilo {
  return { uid, nome: uid, email, foto: null, tipo: 'studente' }
}
