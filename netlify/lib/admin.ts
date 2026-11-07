/**
 * Firebase Admin per le funzioni sul server. Con l'emulatore (FIRESTORE_EMULATOR_HOST) basta l'id del progetto.
 * In produzione servono due valori dell'account di servizio (dal file JSON scaricato da Firebase):
 * FIREBASE_CLIENT_EMAIL ("client_email") e FIREBASE_PRIVATE_KEY ("private_key").
 * Solo questi due, non tutto il file: su Netlify le variabili insieme non possono superare circa 4 KB.
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

/** Id del progetto Firebase: FIREBASE_PROJECT_ID, oppure lo si ricava dall'email dell'account di servizio (…@<progetto>.iam.gserviceaccount.com). */
export const PROGETTO = process.env.FIREBASE_PROJECT_ID ?? progettoDaEmail(process.env.FIREBASE_CLIENT_EMAIL)

export function progettoDaEmail(email: string | undefined): string {
  return /@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/.exec(email?.trim() ?? '')?.[1] ?? ''
}

function app(): App {
  const esistente = getApps()[0]
  if (esistente) return esistente
  if (process.env.FIRESTORE_EMULATOR_HOST) return initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-whosnext' })
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  // incollata con i "\n" letterali oppure su più righe: va bene in entrambi i modi
  // (anche con le virgolette del file JSON intorno)
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim().replace(/^"|",?$/g, '').replace(/\\n/g, '\n')
  if (!clientEmail || !privateKey) throw new Error('Mancano FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY nelle variabili di Netlify')
  if (!privateKey.includes('-----END PRIVATE KEY-----'))
    throw new Error('FIREBASE_PRIVATE_KEY è tagliata: deve finire con "-----END PRIVATE KEY-----"')
  return initializeApp({ credential: cert({ projectId: PROGETTO, clientEmail, privateKey }), projectId: PROGETTO })
}

export function database(): Firestore {
  return getFirestore(app())
}

export function messaggistica() {
  return getMessaging(app())
}
