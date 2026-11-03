/** Traduce i codici di errore di Firebase Auth in messaggi comprensibili. */

export type MessaggioErrore = {
  titolo: string
  dettaglio: string
  /** true quando l'errore probabilmente dipende da un blocco della scuola */
  possibileBloccoScuola?: boolean
}

export function messaggioErroreAuth(codice: string | undefined): MessaggioErrore | null {
  switch (codice) {
    case 'auth/cancelled-popup-request':
      return null // un secondo click ha sostituito il primo popup: nessun errore da mostrare
    case 'auth/popup-closed-by-user':
    case 'auth/user-cancelled':
      return {
        titolo: 'Finestra di accesso chiusa',
        dettaglio:
          'La finestra di Google è stata chiusa prima di completare l\'accesso. ' +
          'Se Google mostrava "Accesso bloccato" o "Il tuo amministratore non consente l\'accesso", ' +
          'la scuola blocca questa app: va chiesto al referente informatico di autorizzare l\'ID client OAuth.',
        possibileBloccoScuola: true,
      }
    case 'auth/admin-restricted-operation':
      return {
        titolo: 'Operazione bloccata dall\'amministratore',
        dettaglio: 'L\'accesso è stato bloccato da una regola di amministrazione.',
        possibileBloccoScuola: true,
      }
    case 'auth/popup-blocked':
      return {
        titolo: 'Popup bloccato dal browser',
        dettaglio: 'Il browser ha bloccato la finestra di accesso. Consenti i popup per questo sito e riprova.',
      }
    case 'auth/unauthorized-domain':
      return {
        titolo: 'Dominio del sito non autorizzato',
        dettaglio:
          'Aggiungi questo indirizzo in Firebase: Authentication > Impostazioni > Domini autorizzati.',
      }
    case 'auth/operation-not-allowed':
      return {
        titolo: 'Accesso con Google non attivo',
        dettaglio: 'Attiva il provider Google in Firebase: Authentication > Metodo di accesso.',
      }
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
      return {
        titolo: 'Configurazione Firebase errata',
        dettaglio: 'La chiave API nel file .env non è valida. Ricopiala dalla console Firebase.',
      }
    case 'auth/network-request-failed':
      return {
        titolo: 'Problema di rete',
        dettaglio: 'Controlla la connessione. Alcune reti scolastiche bloccano i servizi Google: prova con i dati mobili.',
      }
    case 'auth/too-many-requests':
      return { titolo: 'Troppi tentativi', dettaglio: 'Aspetta qualche minuto e riprova.' }
    case 'auth/web-storage-unsupported':
      return {
        titolo: 'Browser non supportato',
        dettaglio: 'Il browser blocca lo spazio di archiviazione (forse sei in navigazione privata). Prova una finestra normale.',
      }
    default:
      return {
        titolo: 'Accesso non riuscito',
        dettaglio: codice ? `Errore imprevisto (${codice}).` : 'Errore imprevisto.',
      }
  }
}
