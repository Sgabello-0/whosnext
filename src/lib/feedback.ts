/** Feedback per lo sviluppatore: lo riceve il server (/api/feedback), che lo salva e lo manda per email. */
import { auth } from './firebase'
import { ErroreApp } from './classi'

const URL_NOTIFICHE = import.meta.env.VITE_URL_NOTIFICHE as string | undefined
/** stesso server delle notifiche */
const URL_FEEDBACK = URL_NOTIFICHE ? new URL('/api/feedback', URL_NOTIFICHE).toString() : null

export const feedbackAttivo = !!URL_FEEDBACK
export const MAX_FEEDBACK = 2000

/** 'inviato': arrivato per email; 'salvato': ricevuto e salvato, l'email partirà più avanti o si leggerà dal database. */
export async function inviaFeedback(testo: string, pagina: string | null = null): Promise<'inviato' | 'salvato'> {
  const utente = auth?.currentUser
  if (!URL_FEEDBACK || !utente) throw new ErroreApp('dati-non-validi', 'Il feedback non è disponibile in questo momento.')
  const pulito = testo.trim()
  if (pulito.length < 3) throw new ErroreApp('dati-non-validi', 'Scrivi qualche parola in più.')
  if (pulito.length > MAX_FEEDBACK) throw new ErroreApp('dati-non-validi', `Massimo ${MAX_FEEDBACK} caratteri.`)
  let risposta: Response
  try {
    risposta = await fetch(URL_FEEDBACK, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await utente.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ testo: pulito, pagina }),
    })
  } catch {
    throw new ErroreApp('dati-non-validi', 'Invio non riuscito: controlla la connessione e riprova.')
  }
  if (risposta.status === 429) throw new ErroreApp('troppe-richieste', 'Hai già inviato 5 feedback oggi: riprova domani.')
  if (!risposta.ok) throw new ErroreApp('dati-non-validi', 'Invio non riuscito. Riprova più tardi.')
  const corpo = (await risposta.json().catch(() => null)) as { esito?: string } | null
  return corpo?.esito === 'inviato' ? 'inviato' : 'salvato'
}
