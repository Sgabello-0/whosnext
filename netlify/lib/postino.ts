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
  const invio = db.collection('invii').doc(idSicuro(chiave))
  try {
    await invio.create({ uid, quando: FieldValue.serverTimestamp() })
  } catch (e) {
    // 6 = ALREADY_EXISTS: già mandata (anche da un'altra esecuzione nello stesso momento)
    if ((e as { code?: number }).code === 6) return 'gia-mandata'
    throw e
  }
  try {
    return await consegna(db, postino, uid, n, idSicuro(chiave))
  } catch (e) {
    // non consegnata (rete, servizio delle push…): si toglie il segno, così un'altra esecuzione può riprovare
    await invio.delete().catch(() => {})
    throw e
  }
}

async function consegna(db: Firestore, postino: Postino, uid: string, n: Notifica, id: string): Promise<Esito> {
  const utente = await db.collection('users').doc(uid).get()
  const u = utente.data() as
    | { email?: string; fcmTokens?: string[]; impostazioni?: { notifichePush?: boolean; notificheEmail?: boolean } }
    | undefined
  if (!u) return 'nessun-utente'
  // Notification Box: anche con le push spente. Stesso id della notifica, così un nuovo tentativo non la raddoppia.
  await utente.ref
    .collection('notifiche')
    .doc(id)
    .set({ titolo: n.titolo, testo: n.testo, link: n.percorso, quando: FieldValue.serverTimestamp(), letta: false })
    .catch((e: unknown) => console.error(`Notification Box non aggiornata per ${uid}:`, e))
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
