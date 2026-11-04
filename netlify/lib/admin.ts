/**
 * Firebase Admin per le funzioni sul server. Con l'emulatore (FIRESTORE_EMULATOR_HOST) basta l'id del progetto;
 * in produzione serve la chiave dell'account di servizio in FIREBASE_SERVICE_ACCOUNT (JSON, anche in base64).
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

function app(): App {
  const esistente = getApps()[0]
  if (esistente) return esistente
  if (process.env.FIRESTORE_EMULATOR_HOST) return initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'demo-whosnext' })
  const grezzo = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!grezzo) throw new Error('Manca FIREBASE_SERVICE_ACCOUNT nelle variabili di Netlify')
  const json = grezzo.trim().startsWith('{') ? grezzo : Buffer.from(grezzo, 'base64').toString('utf8')
  return initializeApp({ credential: cert(JSON.parse(json)) })
}

export function database(): Firestore {
  return getFirestore(app())
}

export function autenticazione() {
  return getAuth(app())
}

export function messaggistica() {
  return getMessaging(app())
}
