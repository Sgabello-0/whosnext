import { useState } from 'react'
import { CalendarX } from 'lucide-react'
import { db } from '../../lib/firebase'
import { aggiungiGiorni, formattaGiorno } from '../../lib/calendar'
import { messaggioErrore } from '../../lib/errori'
import { dichiaraAssenza } from '../../lib/gestioneLista'
import type { DatiProgramma } from '../../lib/programma'
import { assenzaInRitardo, dateAssenza, primaDataLibera } from '../../lib/spostamenti'
import { useAvvisi } from '../Avvisi'
import { useConferma } from '../Conferma'
import { Bottone, CLASSE_INPUT } from '../ui'

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

const minuscolo = (d: string) => formattaGiorno(d).toLowerCase()

/** "Non ci sarò": lo studente passa alla prima data disponibile, con data fissa. */
export function NonCiSaro(p: { r: Rif; uid: string; programma: DatiProgramma; giorniAnticipo: number }) {
  const avvisi = useAvvisi()
  const conferma = useConferma()
  const [scelta, setScelta] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const date = dateAssenza(p.programma, p.uid)
  if (date.length === 0) return null
  const data = date.includes(scelta) ? scelta : date[0]!

  async function dichiara() {
    if (!db) return
    const d = db
    const nuova = primaDataLibera(p.programma, p.uid, data)
    if (!nuova) {
      avvisi.errore('Non ci sono altre lezioni disponibili: parlane con il capoclasse.')
      return
    }
    const ritardo = assenzaInRitardo(p.programma.adesso.oggi, data, p.giorniAnticipo)
    const ok = await conferma({
      titolo: `Non ci sarai ${minuscolo(data)}?`,
      testo: `Passi a ${minuscolo(nuova)}, con data fissa, e chi finisce prima di te riceve un avviso.${
        ritardo ? ` Il termine era ${minuscolo(aggiungiGiorni(data, -p.giorniAnticipo))}: anche capoclasse e vice saranno avvisati.` : ''
      } Per tornare indietro dovrai chiedere al capoclasse.`,
      pulsante: 'Conferma',
    })
    if (!ok) return
    setInCorso(true)
    try {
      await dichiaraAssenza(d, p.r, p.uid, data, nuova)
      avvisi.mostra(`Spostato a ${minuscolo(nuova)}`)
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {date.length > 1 && (
        <select
          aria-label="Giorno in cui non ci sarai"
          value={data}
          onChange={(e) => setScelta(e.target.value)}
          className={`${CLASSE_INPUT} max-w-56 py-1.5 text-slate-900 dark:text-slate-100`}
        >
          {date.map((d) => (
            <option key={d} value={d}>
              {formattaGiorno(d)}
            </option>
          ))}
        </select>
      )}
      <Bottone variante="secondario" icona={CalendarX} disabled={inCorso} onClick={dichiara}>
        Non ci sarò
      </Bottone>
    </div>
  )
}
