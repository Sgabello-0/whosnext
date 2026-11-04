import { useState, type FormEvent } from 'react'
import type { DatiInterrogazione } from '../lib/configurazione'
import { messaggioErrore } from '../lib/errori'
import { aInputDataOra, daInputDataOra, scadenzaPredefinita } from '../lib/formatoDate'
import { Bottone, Campo, CLASSE_INPUT, Etichetta, SelettoreGiorni } from './ui'

/** Modulo per creare o modificare un'interrogazione. */
export function FormInterrogazione(props: {
  iniziale?: DatiInterrogazione
  /** giorni della materia, proposti per una nuova interrogazione */
  giorniMateria: number[]
  testoSalva: string
  onSalva: (d: DatiInterrogazione) => Promise<void>
  onAnnulla?: () => void
}) {
  const i = props.iniziale
  const [nome, setNome] = useState(i?.nome ?? '')
  const [descrizione, setDescrizione] = useState(i?.descrizione ?? '')
  const [giorni, setGiorni] = useState<number[]>(i?.giorni ?? props.giorniMateria)
  const [perLezione, setPerLezione] = useState(i?.perLezione ? String(i.perLezione) : '')
  const [scadenza, setScadenza] = useState(aInputDataOra(i?.scadenzaPreferenze ?? scadenzaPredefinita()))
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)

  async function invia(e: FormEvent) {
    e.preventDefault()
    const data = daInputDataOra(scadenza)
    if (!data) return setErrore('Indica la scadenza per le preferenze.')
    const numero = perLezione.trim() === '' ? null : Number(perLezione)
    setErrore(null)
    setInCorso(true)
    try {
      await props.onSalva({ nome, descrizione, giorni, perLezione: numero, scadenzaPreferenze: data })
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <form onSubmit={invia} className="space-y-5">
      <Campo etichetta="Nome" valore={nome} onChange={setNome} placeholder="Es. Orale sul capitolo 3" maxLength={60} />
      <Etichetta testo="Descrizione (facoltativa)">
        <textarea
          value={descrizione}
          onChange={(e) => setDescrizione(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="Argomenti, pagine, cosa portare…"
          className={CLASSE_INPUT}
        />
      </Etichetta>
      <div>
        <SelettoreGiorni etichetta="Giorni in cui si interroga" valore={giorni} onChange={setGiorni} />
        <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400">
          Proposti quelli della materia. Se li togli tutti, la stima dirà solo "tra N lezioni".
        </p>
      </div>
      <Etichetta testo="Interrogati per lezione (facoltativo)" aiuto="Se non lo sai lascia vuoto: la data stimata non sarà disponibile.">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={50}
          value={perLezione}
          onChange={(e) => setPerLezione(e.target.value)}
          className={`${CLASSE_INPUT} max-w-32`}
        />
      </Etichetta>
      <Etichetta testo="Scadenza per le preferenze" aiuto="Fino ad allora ognuno sceglie inizio, metà o fine. Poi si genera la lista.">
        <input
          type="datetime-local"
          required
          value={scadenza}
          onChange={(e) => setScadenza(e.target.value)}
          className={`${CLASSE_INPUT} max-w-64`}
        />
      </Etichetta>
      {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <Bottone type="submit" disabled={inCorso || !nome.trim()}>
          {inCorso ? 'Salvataggio…' : props.testoSalva}
        </Bottone>
        {props.onAnnulla && (
          <Bottone variante="secondario" onClick={props.onAnnulla}>
            Annulla
          </Bottone>
        )}
      </div>
    </form>
  )
}
