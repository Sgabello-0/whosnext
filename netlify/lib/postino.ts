/**
 * Invio delle notifiche: push (Firebase Cloud Messaging) ed email (Gmail, se configurata).
 * Ogni notifica ha una chiave: se è già stata mandata non si manda di nuovo (documento invii/{chiave}).
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import type { Email } from './email'
import type { Notifica } from './testi'

export type Postino = {
  /** manda la push ai dispositivi; restituisce i token non più validi (da togliere) */
  push(tokens: string[], n: Notifica): Promise<string[]>
  email(a: string, e: Email): Promise<void>
}

export type Esito = 'mandata' | 'gia-mandata' | 'nessun-utente'

function idSicuro(chiave: string): string {
  return chiave.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 1400)
}

export async function avvisa(db: Firestore, postino: Postino, uid: string, chiave: string, n: Notifica): Promise<Esito> {
  try {
    await db.collection('invii').doc(idSicuro(chiave)).create({ uid, quando: FieldValue.serverTimestamp() })
  } catch (e) {
    // 6 = ALREADY_EXISTS: già mandata (anche da un'altra esecuzione nello stesso momento)
    if ((e as { code?: number }).code === 6) return 'gia-mandata'
    throw e
  }
  const utente = await db.collection('users').doc(uid).get()
  const u = utente.data() as
    | { email?: string; fcmTokens?: string[]; impostazioni?: { notifichePush?: boolean; notificheEmail?: boolean } }
    | undefined
  if (!u) return 'nessun-utente'
  const tokens = u.fcmTokens ?? []
  if (u.impostazioni?.notifichePush !== false && tokens.length > 0) {
    const nonValidi = await postino.push(tokens, n)
    if (nonValidi.length > 0) await utente.ref.update({ fcmTokens: FieldValue.arrayRemove(...nonValidi) })
  }
  if (n.email && u.impostazioni?.notificheEmail !== false && u.email) {
    await postino.email(u.email, n.email)
  }
  return 'mandata'
}
