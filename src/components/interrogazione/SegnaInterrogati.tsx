import { useState } from 'react'
import { db } from '../../lib/firebase'
import { formattaGiorno, oggiISO, type Calendario } from '../../lib/calendar'
import { messaggioErrore } from '../../lib/errori'
import { salvaLezione, segnaSaltato } from '../../lib/gestioneLista'
import { nonInterrogati, propostaLezione, ultimaLezione } from '../../lib/lista'
import type { DatiProgramma } from '../../lib/programma'
import { primaDataLibera } from '../../lib/spostamenti'
import type { Interrogazione, Membro } from '../../lib/tipi'
import { Bottone, CLASSE_INPUT, Etichetta, Riquadro, Scheda } from '../ui'
import { CircleCheck, Flag, ListChecks, Pencil, TriangleAlert } from 'lucide-react'
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
  /** lezioni chiuse con "Fine" */
  chiusi: string[]
  membri: Map<string, Membro>
  cal: Calendario
  mioUid: string
  programma: DatiProgramma
  /** capo e vice: possono segnare "Ha saltato" (il docente della materia no) */
  staff: boolean
}

/**
 * Dopo la lezione: chi aveva la data fissa e i primi N non interrogati sono proposti come interrogati.
 * "Conferma" segna gli interrogati; "Fine" chiude la lezione, anche se non è stato interrogato nessuno
 * (chi non è stato interrogato passa subito alla lezione dopo). Una lezione chiusa si può modificare.
 */
export function SegnaInterrogati(p: Props) {
  const [data, setData] = useState(() => ultimaLezione(p.interrogazione.giorni, p.r.subjectId, p.cal, oggiISO()) ?? oggiISO())
  // la lezione chiusa che si sta modificando
  const [inModifica, setInModifica] = useState<string | null>(null)

  const tutti = [...p.ordine, ...Object.keys(p.fissi)]
  if (tutti.every((u) => p.interrogati[u])) return null
  const chiusa = p.chiusi.includes(data)
  const diQuelGiorno = tutti.filter((u) => p.interrogati[u] === data)
  const nome = (u: string) => p.membri.get(u)?.nome ?? 'Ex membro'

  return (
    <Scheda titolo="Segna chi è stato interrogato" icona={ListChecks} tono={chiusa && inModifica !== data ? 'normale' : 'evidenza'}>
      <div className="space-y-5 text-sm">
        <Etichetta testo="Lezione del">
          <input
            type="date"
            value={data}
            max={oggiISO()}
            onChange={(e) => {
              setData(e.target.value)
              setInModifica(null)
            }}
            className={`${CLASSE_INPUT} max-w-48`}
          />
        </Etichetta>
        {chiusa && inModifica !== data ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
              <CircleCheck aria-hidden className="size-4.5" />
              Lezione chiusa
            </p>
            <p>
              {diQuelGiorno.length > 0
                ? `Interrogati: ${diQuelGiorno.map(nome).join(', ')}.`
                : 'Nessuno è stato interrogato in questa lezione.'}
            </p>
            <Bottone variante="secondario" icona={Pencil} onClick={() => setInModifica(data)}>
              Modifica
            </Bottone>
          </div>
        ) : (
          <ModuloLezione key={`${data}|${chiusa}`} {...p} data={data} chiusa={chiusa} diQuelGiorno={diQuelGiorno} onFine={() => setInModifica(null)} />
        )}
      </div>
    </Scheda>
  )
}

/** Le spunte di una lezione: chi è già segnato quel giorno, i previsti e chi si aggiunge. */
function ModuloLezione(p: Props & { data: string; chiusa: boolean; diQuelGiorno: string[]; onFine: () => void }) {
  const [proposta] = useState(() =>
    p.senzaLista
      ? [...nonInterrogati(p.ordine, p.interrogati), ...nonInterrogati(Object.keys(p.fissi), p.interrogati)]
      : propostaLezione(p.ordine, p.interrogati, p.interrogazione.perLezione, p.fissi, p.data),
  )
  // i previsti sono già spuntati solo finché quel giorno non è stato segnato nessuno (e mai se la lezione è chiusa)
  const [scelti, setScelti] = useState<Set<string>>(
    () => new Set([...p.diQuelGiorno, ...(p.senzaLista || p.chiusa || p.diQuelGiorno.length > 0 ? [] : proposta)]),
  )
  const [aggiunti, setAggiunti] = useState<string[]>([])
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()
  const chiedi = useConferma()

  const nome = (u: string) => p.membri.get(u)?.nome ?? 'Ex membro'
  const giorno = formattaGiorno(p.data).toLowerCase()
  const mancanti = [...nonInterrogati(p.ordine, p.interrogati), ...nonInterrogati(Object.keys(p.fissi), p.interrogati)]
  const elenco = [...new Set([...p.diQuelGiorno, ...proposta, ...aggiunti])]
  const altri = mancanti.filter((u) => !elenco.includes(u))
  const segna = elenco.filter((u) => scelti.has(u) && !p.interrogati[u])
  const togli = p.diQuelGiorno.filter((u) => !scelti.has(u))
  const cambiamenti = segna.length + togli.length > 0

  function cambia(u: string, si: boolean) {
    setScelti((s) => {
      const n = new Set(s)
      if (si) n.add(u)
      else n.delete(u)
      return n
    })
  }

  async function salva(chiudi: boolean) {
    if (!db) return
    setInCorso(true)
    setErrore(null)
    try {
      const annulla = await salvaLezione(db, p.r, { data: p.data, segna, togli, chiudi: chiudi || undefined }, p.mioUid)
      const testo = chiudi
        ? `Lezione di ${giorno} chiusa${segna.length ? `: ${segna.length === 1 ? `${nome(segna[0]!)} interrogato` : `${segna.length} interrogati`}` : ''}`
        : togli.length > 0 || p.chiusa
          ? 'Interrogati della lezione salvati'
          : segna.length === 1
            ? `${nome(segna[0]!)} segnato come interrogato`
            : `${segna.length} segnati come interrogati`
      avvisi.mostra(testo, { annulla })
      p.onFine()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  /** Non si è presentato: come dire "non ci sarò" dopo il termine. */
  async function saltato(u: string) {
    if (!db) return
    const d = db
    const nuova = primaDataLibera(p.programma, u, p.data)
    if (!nuova) {
      setErrore('Non ci sono altre lezioni disponibili.')
      return
    }
    const quando = formattaGiorno(nuova).toLowerCase()
    const ok = await chiedi({
      titolo: `${nome(u)} ha saltato l'interrogazione?`,
      testo: `Passa a ${quando}, con data fissa, e accanto al nome compare il segnale di attenzione finché non viene interrogato.`,
      pulsante: 'Ha saltato',
    })
    if (!ok) return
    setErrore(null)
    try {
      const annulla = await segnaSaltato(d, p.r, u, p.data, nuova, p.mioUid)
      avvisi.mostra(`${nome(u)} passa a ${quando}`, { annulla })
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  return (
    <>
      <div className="space-y-2">
        <p>
          {p.chiusa
            ? 'Togli la spunta a chi non è stato interrogato o aggiungi chi manca.'
            : p.senzaLista
              ? 'Spunta chi è stato interrogato.'
              : `Interrogati previsti: togli la spunta a chi era assente (resterà in testa alla lista).${
                  p.staff ? ' Se doveva esserci e non si è presentato, usa "Ha saltato".' : ''
                }`}
        </p>
        <ul className="space-y-0.5">
          {elenco.map((u) => (
            <li key={u} className="flex flex-wrap items-center gap-1">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <input type="checkbox" checked={scelti.has(u)} onChange={(e) => cambia(u, e.target.checked)} className="size-5 accent-accento" />
                {nome(u)}
              </label>
              {p.staff && !p.senzaLista && !p.interrogati[u] && (
                <Bottone variante="piccolo" icona={TriangleAlert} aria-label={`Ha saltato ${nome(u)}`} disabled={inCorso} onClick={() => saltato(u)}>
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
      {p.chiusa ? (
        <div className="flex flex-wrap gap-2">
          <Bottone onClick={() => salva(false)} disabled={inCorso || !cambiamenti}>
            {inCorso ? 'Salvataggio…' : 'Salva'}
          </Bottone>
          <Bottone variante="secondario" onClick={p.onFine} disabled={inCorso}>
            Annulla
          </Bottone>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Bottone onClick={() => salva(false)} disabled={inCorso || !cambiamenti}>
              {inCorso
                ? 'Salvataggio…'
                : togli.length > 0
                  ? 'Salva modifiche'
                  : `Conferma ${segna.length} ${segna.length === 1 ? 'interrogato' : 'interrogati'}`}
            </Bottone>
            <Bottone variante="secondario" icona={Flag} onClick={() => salva(true)} disabled={inCorso}>
              Fine
            </Bottone>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            "Fine" chiude la lezione di {giorno}, anche se non è stato interrogato nessuno: chi è spuntato viene segnato, gli
            altri passano alla lezione dopo.
          </p>
        </div>
      )}
    </>
  )
}
