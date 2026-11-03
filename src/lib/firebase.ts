import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { DOMINI_DEFAULT, type DominiScuola } from './domain'

const env = import.meta.env

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const DOMINI: DominiScuola = {
  // VITE_DOMINIO_SCUOLA è il vecchio nome, tenuto per compatibilità con i .env già creati
  studenti: env.VITE_DOMINIO_STUDENTI || env.VITE_DOMINIO_SCUOLA || DOMINI_DEFAULT.studenti,
  docenti: env.VITE_DOMINIO_DOCENTI || DOMINI_DEFAULT.docenti,
}

/** Variabili d'ambiente obbligatorie ancora vuote (lista vuota = configurazione completa). */
export const configMancante: string[] = Object.entries({
  VITE_FIREBASE_API_KEY: config.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN: config.authDomain,
  VITE_FIREBASE_PROJECT_ID: config.projectId,
  VITE_FIREBASE_APP_ID: config.appId,
})
  .filter(([, v]) => !v)
  .map(([k]) => k)

export const app: FirebaseApp | null = configMancante.length === 0 ? initializeApp(config) : null
export const auth: Auth | null = app ? getAuth(app) : null
if (auth) auth.languageCode = 'it'

export function providerGoogle(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({
    // '*' chiede a Google di mostrare solo account Google Workspace (niente Gmail personali).
    // Non si può indicare più di un dominio: studenti e docenti stanno su domini diversi.
    // È solo un suggerimento: il controllo vero è su email e regole Firestore.
    hd: '*',
    prompt: 'select_account',
  })
  return provider
}
