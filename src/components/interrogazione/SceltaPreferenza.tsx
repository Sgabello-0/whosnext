import { useState } from 'react'
import { db } from '../../lib/firebase'
import { rifPreferenza } from '../../lib/configurazione'
import { messaggioErrore } from '../../lib/errori'
import type { Scelta } from '../../lib/generateList'
import { useDocumento } from '../../lib/hooks'
import { salvaPreferenza, togliPreferenza } from '../../lib/preferenze'
import { descriviScelta, ETICHETTA_SCELTA, SPIEGAZIONE_SCELTA } from '../../lib/testiPreferenze'
import { formattaGiorno } from '../../lib/calendar'
import type { DocPreferenza } from '../../lib/tipi'
import { Bottone, CLASSE_INPUT, Caricamento, Riquadro, Scheda } from '../ui'
import { ArrowDownToLine, ArrowUpToLine, CircleCheck, Hand, Lock, MoveVertical, Shuffle, type LucideIcon } from 'lucide-react'

const ICONA_SCELTA: Record<'inizio' | 'meta' | 'fine' | 'indifferente', LucideIcon> = {
  inizio: ArrowUpToLine,
  meta: MoveVertical,
  fine: ArrowDownToLine,
  indifferente: Shuffle,
}
import { useAvvisi } from '../Avvisi'

type Props = {
  classId: string
  subjectId: string
  interrogazioneId: string
  uid: string
  /** ha il badge DSA/BES: può scegliere la data */
  dsa: boolean
  /** le date tra cui può scegliere chi ha il badge DSA/BES */
  dateDSA: string[]
  aperta: boolean
  /** escluso dal capoclasse o dal vice */
  escluso: boolean
}

/** La preferenza dello studente: inizio, metà, fine, non mi interessa (o la data, per DSA/BES). */
export function SceltaPreferenza(p: Props) {
  const r = { classId: p.classId, subjectId: p.subjectId, interrogazioneId: p.interrogazioneId }
  const mia = useDocumento<DocPreferenza>(db && rifPreferenza(db, p.classId, p.subjectId, p.interrogazioneId, p.uid))
  const [dataScelta, setDataScelta] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()

  async function scegli(scelta: Scelta, data: string | null = null) {
    if (!db) return
    setInCorso(true)
    setErrore(null)
    try {
      await salvaPreferenza(db, r, p.uid, scelta, data)
      avvisi.mostra(`Preferenza salvata: ${descriviScelta({ scelta, dataDSA: data })}`)
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  async function togli() {
    if (!db) return
    const d = db
    const prima = mia.dati
    setErrore(null)
    try {
      await togliPreferenza(d, r, p.uid)
      avvisi.mostra('Scelta tolta', {
        annulla: prima ? () => salvaPreferenza(d, r, p.uid, prima.scelta, prima.dataDSA ?? null) : undefined,
      })
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  if (p.escluso) {
    return (
      <Riquadro tono="info" icona={Lock}>
        Sei stato escluso da questa interrogazione: non entrerai in lista. Se pensi che sia un errore, chiedi al
        capoclasse o al vice.
      </Riquadro>
    )
  }
  if (mia.errore) return <Riquadro tono="errore">{messaggioErrore(mia.errore)}</Riquadro>
  if (mia.dati === undefined) return <Caricamento />

  const attuale = mia.dati
  const descrizioneAttuale = attuale ? descriviScelta(attuale) : null

  if (!p.aperta) {
    return (
      <Scheda titolo="La tua preferenza" icona={Lock}>
        <p className="text-sm">
          {descrizioneAttuale ? (
            <>
              Hai scelto: <strong>{descrizioneAttuale}</strong>. Le preferenze sono chiuse: la lista sarà
              pubblicata a breve.
            </>
          ) : (
            'Non hai espresso una preferenza: avrai uno dei posti rimasti dopo gli altri.'
          )}
        </p>
      </Scheda>
    )
  }

  const giornoScelto = dataScelta ?? (attuale?.scelta === 'data' ? attuale.dataDSA : null) ?? p.dateDSA[0] ?? null
  // la data scelta prima può non essere più tra quelle proposte (calendario cambiato): resta comunque visibile
  const date = giornoScelto && !p.dateDSA.includes(giornoScelto) ? [giornoScelto, ...p.dateDSA] : p.dateDSA

  return (
    <Scheda titolo="Quando vuoi essere interrogato?" icona={Hand} tono={attuale ? 'normale' : 'evidenza'}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="La tua preferenza">
          {(['inizio', 'meta', 'fine', 'indifferente'] as const).map((s) => {
            const scelta = attuale?.scelta === s
            const Icona = ICONA_SCELTA[s]
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={scelta}
                disabled={inCorso}
                onClick={() => scegli(s)}
                className={`relative rounded-2xl border-2 px-3 py-3 text-left transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accento active:scale-[0.98] disabled:opacity-60 ${
                  scelta
                    ? 'border-accento bg-accento text-white shadow-md'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                }`}
              >
                <Icona aria-hidden className={`mb-1.5 size-5 ${scelta ? 'text-white' : 'text-accento dark:text-blue-300'}`} />
                {scelta && <CircleCheck aria-hidden className="pop absolute top-2.5 right-2.5 size-5" />}
                <span className="block font-semibold">{ETICHETTA_SCELTA[s]}</span>
                <span className={`block text-xs ${scelta ? 'text-blue-100' : 'text-slate-600 dark:text-slate-400'}`}>{SPIEGAZIONE_SCELTA[s]}</span>
              </button>
            )
          })}
        </div>

        {p.dsa && (
          <div className="space-y-2 rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/40">
            <p className="text-sm">
              Con il badge <strong>DSA/BES</strong> puoi scegliere il giorno preciso dell'interrogazione. Se quel
              giorno non vieni interrogato, passi alla lezione successiva.
            </p>
            {date.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Per questa interrogazione non ci sono date di lezione da scegliere: indica una preferenza qui sopra.
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Giorno dell'interrogazione"
                  value={giornoScelto ?? ''}
                  onChange={(e) => setDataScelta(e.target.value)}
                  className={`${CLASSE_INPUT} max-w-56`}
                >
                  {date.map((d) => (
                    <option key={d} value={d}>
                      {formattaGiorno(d)}
                    </option>
                  ))}
                </select>
                <Bottone
                  variante={attuale?.scelta === 'data' ? 'primario' : 'secondario'}
                  disabled={inCorso || !giornoScelto}
                  onClick={() => scegli('data', giornoScelto)}
                >
                  {attuale?.scelta === 'data' && attuale.dataDSA === giornoScelto ? 'Data scelta' : 'Scegli questa data'}
                </Bottone>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          <span role="status">
            {descrizioneAttuale ? (
              <>
                La tua scelta: <strong>{descrizioneAttuale}</strong>. Puoi cambiarla fino alla scadenza.
              </>
            ) : (
              'Non hai ancora indicato una preferenza. Senza una scelta ti verrà assegnato uno dei posti rimasti.'
            )}
          </span>
          {attuale && (
            <button type="button" className="text-slate-600 underline dark:text-slate-400" onClick={togli}>
              Togli la mia scelta
            </button>
          )}
        </div>
        {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
      </div>
    </Scheda>
  )
}
