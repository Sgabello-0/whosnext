import { copiaTesto } from '../lib/diagnostica'
import { linkWhatsApp } from '../lib/messaggi'
import { useAvvisi } from './Avvisi'
import { Bottone } from './ui'

/** Pulsanti per mandare un testo: WhatsApp, Copia e (se il telefono lo permette) Condividi. */
export function Condividi(props: { testo: string; titolo: string; etichetta?: string }) {
  const avvisi = useAvvisi()

  async function copia() {
    if (await copiaTesto(props.testo)) avvisi.mostra('Testo copiato: incollalo dove vuoi')
    else avvisi.errore('Non riesco a copiare: usa "Condividi" o seleziona il testo a mano')
  }

  async function condividi() {
    try {
      await navigator.share({ title: props.titolo, text: props.testo })
    } catch {
      /* annullato dall'utente */
    }
  }

  return (
    <div className="space-y-1.5">
      {props.etichetta && <p className="text-sm font-medium">{props.etichetta}</p>}
      <div className="flex flex-wrap gap-2">
        <a
          href={linkWhatsApp(props.testo)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          WhatsApp
        </a>
        <Bottone variante="piccolo" onClick={copia}>
          Copia messaggio
        </Bottone>
        {'share' in navigator && (
          <Bottone variante="piccolo" onClick={condividi}>
            Condividi
          </Bottone>
        )}
      </div>
    </div>
  )
}
