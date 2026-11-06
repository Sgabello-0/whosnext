/**
 * Dopo un'azione che merita una notifica (interrogazione creata, lista generata a mano, scambio chiesto)
 * il sito lo dice al server, che controlla e avvisa. Se il server non è configurato non fa niente;
 * se non risponde pazienza: l'azione è comunque fatta.
 */
import { auth } from './firebase'

const URL_NOTIFICHE = import.meta.env.VITE_URL_NOTIFICHE as string | undefined

export const serverAttivo = !!URL_NOTIFICHE

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

export function avvisaServer(tipo: 'nuova-interrogazione' | 'lista-pronta' | 'scambio-richiesta', r: Rif, id?: string): void {
  const utente = auth?.currentUser
  if (!URL_NOTIFICHE || !utente) return
  void (async () => {
    try {
      const token = await utente.getIdToken()
      await fetch(URL_NOTIFICHE, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, ...r, id }),
        keepalive: true,
      })
    } catch {
      /* niente: la notifica è un di più */
    }
  })()
}
