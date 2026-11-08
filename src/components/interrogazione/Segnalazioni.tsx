import { useState } from 'react'
import { db } from '../../lib/firebase'
import { formattaGiorno, oggiISO } from '../../lib/calendar'
import { rifSegnalazione, rifSegnalazioni } from '../../lib/configurazione'
import { messaggioErrore } from '../../lib/errori'
import { segnaInterrogati, segnalaInterrogato, togliSegnalazione } from '../../lib/gestioneLista'
import { useDocumento, useQuery } from '../../lib/hooks'
import type { DocSegnalazione, Membro } from '../../lib/tipi'
import { Bottone, CLASSE_INPUT, Riquadro, Scheda } from '../ui'
import { BellRing } from 'lucide-react'
import { useAvvisi } from '../Avvisi'
import { avvisaServer } from '../../lib/avvisaServer'

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

/** Per chi modifica le liste: segnalazioni "Sono stato interrogato" da confermare. */
export function Segnalazioni(p: { r: Rif; membri: Map<string, Membro>; mioUid: string }) {
  const segnalazioni = useQuery<DocSegnalazione>(
    db && rifSegnalazioni(db, p.r.classId, p.r.subjectId, p.r.interrogazioneId),
    `segnalazioni/${p.r.classId}/${p.r.subjectId}/${p.r.interrogazioneId}`,
  )
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()
  if (!segnalazioni.dati || segnalazioni.dati.length === 0) return null

  async function esegui(azione: () => Promise<void>, avviso: string) {
    setErrore(null)
    try {
      await azione()
      avvisi.mostra(avviso)
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  return (
    <Scheda titolo="Da confermare" icona={BellRing} tono="avviso">
      <ul className="space-y-2 text-sm">
        {segnalazioni.dati.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1">
              <strong>{p.membri.get(s.id)?.nome ?? 'Ex membro'}</strong> segnala l'interrogazione di{' '}
              {formattaGiorno(s.data).toLowerCase()}
            </span>
            <Bottone
              variante="piccolo"
              onClick={() =>
                db && esegui(() => segnaInterrogati(db!, p.r, [s.id], s.data, p.mioUid), 'Interrogazione confermata')
              }
            >
              Conferma
            </Bottone>
            <Bottone variante="piccolo" onClick={() => db && esegui(() => togliSegnalazione(db!, p.r, s.id), 'Segnalazione rifiutata')}>
              Rifiuta
            </Bottone>
          </li>
        ))}
      </ul>
      {errore && <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
    </Scheda>
  )
}

/** Per lo studente non ancora segnato: "Sono stato interrogato". */
export function SonoStatoInterrogato(p: { r: Rif; uid: string }) {
  const mia = useDocumento<DocSegnalazione>(db && rifSegnalazione(db, p.r.classId, p.r.subjectId, p.r.interrogazioneId, p.uid))
  const [data, setData] = useState(oggiISO())
  const [aperto, setAperto] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()

  async function esegui(azione: () => Promise<void>, avviso: string) {
    setErrore(null)
    try {
      await azione()
      avvisi.mostra(avviso)
      setAperto(false)
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  if (mia.dati === undefined) return null
  if (mia.dati) {
    return (
      <Riquadro tono="info">
        Hai segnalato di essere stato interrogato {formattaGiorno(mia.dati.data).toLowerCase()}: in attesa che il
        capoclasse confermi.{' '}
        <button type="button" className="underline" onClick={() => db && esegui(() => togliSegnalazione(db!, p.r, p.uid), 'Segnalazione ritirata')}>
          Ritira
        </button>
        {errore && <span className="block text-rose-700 dark:text-rose-300">{errore}</span>}
      </Riquadro>
    )
  }
  return (
    <div className="space-y-2">
      {!aperto ? (
        <Bottone variante="secondario" onClick={() => setAperto(true)}>
          Sono stato interrogato
        </Bottone>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Quando?</span>
            <input type="date" value={data} max={oggiISO()} onChange={(e) => setData(e.target.value)} className={`${CLASSE_INPUT} max-w-48`} />
          </label>
          <Bottone onClick={() => db && esegui(async () => {
            await segnalaInterrogato(db!, p.r, p.uid, data)
            avvisaServer('segnalazione', p.r)
          }, 'Segnalazione inviata al capoclasse')}>
            Segnala
          </Bottone>
          <Bottone variante="secondario" onClick={() => setAperto(false)}>
            Annulla
          </Bottone>
        </div>
      )}
      {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
    </div>
  )
}
