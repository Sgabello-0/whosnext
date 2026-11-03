import { useState } from 'react'
import { db } from '../../lib/firebase'
import { rifPreferenza } from '../../lib/configurazione'
import { messaggioErrore } from '../../lib/errori'
import type { Scelta } from '../../lib/generateList'
import { useDocumento } from '../../lib/hooks'
import { salvaPreferenza, togliPreferenza } from '../../lib/preferenze'
import { ETICHETTA_SCELTA, SPIEGAZIONE_SCELTA } from '../../lib/testiPreferenze'
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
  /** ha il badge DSA/BES: può chiedere una posizione esatta */
  dsa: boolean
  numeroStudenti: number
  aperta: boolean
}

/** La preferenza dello studente: inizio, metà, fine, non mi interessa (o posizione esatta per DSA/BES). */
export function SceltaPreferenza(p: Props) {
  const r = { classId: p.classId, subjectId: p.subjectId, interrogazioneId: p.interrogazioneId }
  const mia = useDocumento<DocPreferenza>(db && rifPreferenza(db, p.classId, p.subjectId, p.interrogazioneId, p.uid))
  const [posizione, setPosizione] = useState<number | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()

  async function scegli(scelta: Scelta, pos: number | null = null) {
    if (!db) return
    setInCorso(true)
    setErrore(null)
    try {
      await salvaPreferenza(db, r, p.uid, scelta, pos)
      avvisi.mostra(scelta === 'posizione' ? `Hai chiesto la posizione n° ${pos}` : `Preferenza salvata: ${ETICHETTA_SCELTA[scelta].toLowerCase()}`)
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
        annulla: prima ? () => salvaPreferenza(d, r, p.uid, prima.scelta, prima.posizioneDSA) : undefined,
      })
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  if (mia.errore) return <Riquadro tono="errore">{messaggioErrore(mia.errore)}</Riquadro>
  if (mia.dati === undefined) return <Caricamento />

  const attuale = mia.dati
  const descrizioneAttuale = attuale
    ? attuale.scelta === 'posizione'
      ? `posizione n° ${attuale.posizioneDSA}`
      : ETICHETTA_SCELTA[attuale.scelta].toLowerCase()
    : null

  if (!p.aperta) {
    return (
      <Scheda titolo="La tua preferenza" icona={Lock}>
        <p className="text-sm">
          {descrizioneAttuale ? (
            <>
              Hai scelto: <strong>{descrizioneAttuale}</strong>. Le preferenze sono chiuse, a breve il capoclasse
              genererà la lista.
            </>
          ) : (
            'Non hai espresso una preferenza: avrai uno dei posti rimasti dopo gli altri.'
          )}
        </p>
      </Scheda>
    )
  }

  const posizioneScelta = posizione ?? attuale?.posizioneDSA ?? 1

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
                {scelta && <CircleCheck aria-hidden className="absolute top-2.5 right-2.5 size-5" />}
                <span className="block font-semibold">{ETICHETTA_SCELTA[s]}</span>
                <span className={`block text-xs ${scelta ? 'text-blue-100' : 'text-slate-500'}`}>{SPIEGAZIONE_SCELTA[s]}</span>
              </button>
            )
          })}
        </div>

        {p.dsa && (
          <div className="space-y-2 rounded-2xl bg-amber-50 p-3 dark:bg-amber-950/40">
            <p className="text-sm">
              Con il badge <strong>DSA/BES</strong> puoi chiedere una posizione precisa. Se qualcun altro chiede la
              stessa, la ottiene chi l'ha chiesta prima.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Posizione"
                value={posizioneScelta}
                onChange={(e) => setPosizione(Number(e.target.value))}
                className={`${CLASSE_INPUT} max-w-28`}
              >
                {Array.from({ length: Math.max(p.numeroStudenti, 1) }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    n° {i + 1}
                  </option>
                ))}
              </select>
              <Bottone
                variante={attuale?.scelta === 'posizione' ? 'primario' : 'secondario'}
                disabled={inCorso}
                onClick={() => scegli('posizione', posizioneScelta)}
              >
                {attuale?.scelta === 'posizione' && attuale.posizioneDSA === posizioneScelta
                  ? 'Posizione scelta'
                  : 'Chiedi questa posizione'}
              </Bottone>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
          <span role="status">
            {descrizioneAttuale ? (
              <>
                La tua scelta: <strong>{descrizioneAttuale}</strong>. Puoi cambiarla fino alla scadenza.
              </>
            ) : (
              'Non hai ancora scelto. Se non scegli, avrai uno dei posti rimasti.'
            )}
          </span>
          {attuale && (
            <button type="button" className="text-slate-500 underline" onClick={togli}>
              Togli la mia scelta
            </button>
          )}
        </div>
        {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
      </div>
    </Scheda>
  )
}
