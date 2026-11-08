import { useState } from 'react'
import { db } from '../../lib/firebase'
import { formattaGiorno, oggiISO, type Calendario } from '../../lib/calendar'
import { messaggioErrore } from '../../lib/errori'
import { segnaInterrogati, segnaSaltato, togliInterrogato } from '../../lib/gestioneLista'
import { nonInterrogati, propostaLezione, ultimaLezione } from '../../lib/lista'
import type { DatiProgramma } from '../../lib/programma'
import { primaDataLibera } from '../../lib/spostamenti'
import type { Interrogazione, Membro } from '../../lib/tipi'
import { Bottone, CLASSE_INPUT, Etichetta, Riquadro, Scheda } from '../ui'
import { ListChecks, TriangleAlert } from 'lucide-react'
import { useAvvisi } from '../Avvisi'
import { useConferma } from '../Conferma'

type Props = {
  r: { classId: string; subjectId: string; interrogazioneId: string }
  interrogazione: Interrogazione
  ordine: string[]
  /** DSA/BES: uid → data scelta */
  fissi: Record<string, string>
  /** senza lista: si spunta a mano chi è stato interrogato, nessuna proposta */
  senzaLista: boolean
  interrogati: Record<string, string>
  membri: Map<string, Membro>
  cal: Calendario
  mioUid: string
  programma: DatiProgramma
}

/**
 * Dopo la lezione: chi aveva la data fissa e i primi N non interrogati sono proposti come interrogati.
 * Si conferma con un tocco; chi viene tolto (assente) resta in testa ai non interrogati
 * (chi ha la data fissa passa alla lezione successiva).
 */
export function SegnaInterrogati(p: Props) {
  const [data, setData] = useState(
    () => ultimaLezione(p.interrogazione.giorni, p.r.subjectId, p.cal, oggiISO()) ?? oggiISO(),
  )
  const [proposta] = useState(() =>
    p.senzaLista
      ? [...nonInterrogati(p.ordine, p.interrogati), ...nonInterrogati(Object.keys(p.fissi), p.interrogati)]
      : propostaLezione(p.ordine, p.interrogati, p.interrogazione.perLezione, p.fissi, data),
  )
  const [scelti, setScelti] = useState<Set<string>>(() => new Set(p.senzaLista ? [] : proposta))
  const [aggiunti, setAggiunti] = useState<string[]>([])
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()
  const chiedi = useConferma()

  const mancanti = [...nonInterrogati(p.ordine, p.interrogati), ...nonInterrogati(Object.keys(p.fissi), p.interrogati)]
  if (mancanti.length === 0) return null
  const altri = mancanti.filter((u) => !proposta.includes(u) && !aggiunti.includes(u))
  const elenco = [...proposta, ...aggiunti]
  const nome = (u: string) => p.membri.get(u)?.nome ?? 'Ex membro'

  function cambia(u: string, si: boolean) {
    setScelti((s) => {
      const n = new Set(s)
      if (si) n.add(u)
      else n.delete(u)
      return n
    })
  }

  async function conferma() {
    if (!db) return
    setInCorso(true)
    setErrore(null)
    try {
      const d = db
      const segnati = elenco.filter((u) => scelti.has(u))
      await segnaInterrogati(d, p.r, segnati, data, p.mioUid)
      avvisi.mostra(segnati.length === 1 ? `${nome(segnati[0]!)} segnato come interrogato` : `${segnati.length} segnati come interrogati`, {
        annulla: async () => {
          for (const u of segnati) await togliInterrogato(d, p.r, u, p.mioUid)
        },
      })
    } catch (e) {
      setErrore(messaggioErrore(e))
      setInCorso(false)
    }
  }

  /** Non si è presentato: come dire "non ci sarò" dopo il termine. */
  async function saltato(u: string) {
    if (!db) return
    const d = db
    const nuova = primaDataLibera(p.programma, u, data)
    if (!nuova) {
      setErrore('Non ci sono altre lezioni disponibili.')
      return
    }
    const giorno = formattaGiorno(nuova).toLowerCase()
    const ok = await chiedi({
      titolo: `${nome(u)} ha saltato l'interrogazione?`,
      testo: `Passa a ${giorno}, con data fissa, e accanto al nome compare il segnale di attenzione finché non viene interrogato.`,
      pulsante: 'Ha saltato',
    })
    if (!ok) return
    setErrore(null)
    try {
      const annulla = await segnaSaltato(d, p.r, u, data, nuova, p.mioUid)
      avvisi.mostra(`${nome(u)} passa a ${giorno}`, { annulla })
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  const quanti = elenco.filter((u) => scelti.has(u)).length

  return (
    <Scheda titolo="Segna chi è stato interrogato" icona={ListChecks} tono="evidenza">
      <div className="space-y-5 text-sm">
        <Etichetta testo="Lezione del">
          <input type="date" value={data} max={oggiISO()} onChange={(e) => setData(e.target.value)} className={`${CLASSE_INPUT} max-w-48`} />
        </Etichetta>
        <div className="space-y-2">
          <p>
            {p.senzaLista
              ? 'Spunta chi è stato interrogato.'
              : 'Interrogati previsti: togli la spunta a chi era assente (resterà in testa alla lista). Se doveva esserci e non si è presentato, usa "Ha saltato".'}
          </p>
          <ul className="space-y-0.5">
            {elenco.map((u) => (
              <li key={u} className="flex flex-wrap items-center gap-1">
                <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={scelti.has(u)}
                    onChange={(e) => cambia(u, e.target.checked)}
                    className="size-5 accent-accento"
                  />
                  {nome(u)}
                </label>
                {!p.senzaLista && (
                  <Bottone variante="piccolo" icona={TriangleAlert} aria-label={`Ha saltato ${nome(u)}`} disabled={inCorso || !data} onClick={() => saltato(u)}>
                    Ha saltato
                  </Bottone>
                )}
              </li>
            ))}
          </ul>
        </div>
        {altri.length > 0 && (
          <Etichetta testo="Interrogato anche qualcun altro?">
            <select
              value=""
              onChange={(e) => {
                const u = e.target.value
                if (!u) return
                setAggiunti((a) => [...a, u])
                cambia(u, true)
              }}
              className={`${CLASSE_INPUT} max-w-72`}
            >
              <option value="">Aggiungi…</option>
              {altri.map((u) => (
                <option key={u} value={u}>
                  {nome(u)}
                </option>
              ))}
            </select>
          </Etichetta>
        )}
        {errore && <Riquadro tono="errore">{errore}</Riquadro>}
        <Bottone onClick={conferma} disabled={inCorso || quanti === 0 || !data}>
          {inCorso ? 'Salvataggio…' : `Conferma ${quanti} ${quanti === 1 ? 'interrogato' : 'interrogati'}`}
        </Bottone>
      </div>
    </Scheda>
  )
}
