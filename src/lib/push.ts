/**
 * Notifiche push su questo dispositivo: il permesso del browser e il "token" del dispositivo,
 * salvato nel profilo (users/{uid}.fcmTokens) per il server. Firebase Messaging si scarica solo quando serve.
 */
import { arrayRemove, arrayUnion, serverTimestamp, updateDoc } from 'firebase/firestore'
import { rifUtente } from './classi'
import { app, db } from './firebase'

const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined
const CHIAVE = 'push-token'

export type StatoPush = 'non-supportate' | 'negate' | 'spente' | 'attive'

export function pushSupportate(): boolean {
  return !!VAPID && !!app && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

function tokenSalvato(): string | null {
  try {
    return localStorage.getItem(CHIAVE)
  } catch {
    return null
  }
}

export function statoPush(): StatoPush {
  if (!pushSupportate()) return 'non-supportate'
  if (Notification.permission === 'denied') return 'negate'
  return Notification.permission === 'granted' && tokenSalvato() ? 'attive' : 'spente'
}

async function tokenDispositivo(): Promise<string> {
  const { getMessaging, getToken } = await import('firebase/messaging')
  return getToken(getMessaging(app!), { vapidKey: VAPID, serviceWorkerRegistration: await navigator.serviceWorker.ready })
}

/** Chiede il permesso (va chiamata dal tocco di un pulsante) e registra il dispositivo. */
export async function attivaPush(uid: string): Promise<StatoPush> {
  if (!pushSupportate() || !db) return 'non-supportate'
  const permesso = await Notification.requestPermission()
  if (permesso !== 'granted') return permesso === 'denied' ? 'negate' : 'spente'
  const token = await tokenDispositivo()
  await updateDoc(rifUtente(db, uid), {
    fcmTokens: arrayUnion(token),
    'impostazioni.notifichePush': true,
    aggiornato: serverTimestamp(),
  })
  try {
    localStorage.setItem(CHIAVE, token)
  } catch {
    /* il token resta comunque nel profilo */
  }
  return 'attive'
}

export async function disattivaPush(uid: string): Promise<void> {
  const token = tokenSalvato()
  try {
    localStorage.removeItem(CHIAVE)
  } catch {
    /* niente */
  }
  if (!token || !db) return
  await updateDoc(rifUtente(db, uid), { fcmTokens: arrayRemove(token), aggiornato: serverTimestamp() })
  try {
    const { deleteToken, getMessaging } = await import('firebase/messaging')
    await deleteToken(getMessaging(app!))
  } catch {
    /* il server lo toglierà quando risulterà non valido */
  }
}

/** All'apertura: il token può cambiare nel tempo, si tiene aggiornato quello nel profilo. */
export async function aggiornaPush(uid: string): Promise<void> {
  if (statoPush() !== 'attive' || !db) return
  const vecchio = tokenSalvato()
  const nuovo = await tokenDispositivo()
  if (nuovo === vecchio) return
  await updateDoc(rifUtente(db, uid), { fcmTokens: arrayUnion(nuovo), aggiornato: serverTimestamp() })
  if (vecchio) await updateDoc(rifUtente(db, uid), { fcmTokens: arrayRemove(vecchio) })
  try {
    localStorage.setItem(CHIAVE, nuovo)
  } catch {
    /* niente */
  }
}

/** Email per le notifiche più importanti (lista pronta, richieste di scambio). */
export async function impostaEmail(uid: string, attive: boolean): Promise<void> {
  if (!db) return
  await updateDoc(rifUtente(db, uid), { 'impostazioni.notificheEmail': attive, aggiornato: serverTimestamp() })
}
