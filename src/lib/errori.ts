import { FirebaseError } from 'firebase/app'
import { ErroreApp } from './classi'

/** Messaggio comprensibile per un errore di Firestore o dell'app. */
export function messaggioErrore(e: unknown): string {
  if (e instanceof ErroreApp) return e.message
  if (e instanceof FirebaseError) {
    switch (e.code) {
      case 'permission-denied':
        return 'Non hai il permesso di fare questa operazione.'
      case 'unavailable':
        return 'Connessione assente: controlla internet e riprova.'
      case 'not-found':
        return 'Elemento non trovato: forse è stato cancellato.'
      case 'failed-precondition':
        return 'Il database non è ancora pronto. Se hai appena creato il progetto, controlla la guida (Firestore).'
      case 'resource-exhausted':
        return 'Limite gratuito di Firebase raggiunto per oggi. Riprova domani.'
      default:
        return `Errore imprevisto (${e.code}).`
    }
  }
  console.error(e)
  return 'Errore imprevisto.'
}
