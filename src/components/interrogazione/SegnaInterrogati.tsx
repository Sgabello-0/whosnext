import { useState } from 'react'
import { db } from '../../lib/firebase'
import { oggiISO, type Calendario } from '../../lib/calendar'
import { messaggioErrore } from '../../lib/errori'
import { segnaInterrogati } from '../../lib/gestioneLista'
import { nonInterrogati, propostaLezione, ultimaLezione } from '../../lib/lista'
import type { Interrogazione, Membro } from '../../lib/tipi'
import { Bottone, CLASSE_INPUT, Etichetta, Riquadro, Scheda } from '../ui'

type Props = {
  r: { classId: string; subjectId: string; interrogazioneId: string }
  interrogazione: Interrogazione
  ordine: string[]
  interrogati: Record<string, string>
  membri: Map<string, Membro>
  cal: Calendario
  mioUid: string
}

/**
 * Dopo la lezione: i primi N non interrogati sono proposti come "probabilmente interrogati".
 * Si conferma con un tocco; chi viene tolto (assente) resta in testa ai non interrogati.
 */
export function SegnaInterrogati(p: Props) {
  const proposta = propostaLezione(p.ordine, p.interrogati, p.interrogazione.perLezione)
  const [scelti, setScelti] = useState<Set<string>>(() => new Set(proposta))
  const [aggiunti, setAggiunti] = useState<string[]>([])
  const [data, setData] = useState(
    () => ultimaLezione(p.interrogazione.giorni, p.r.subjectId, p.cal, oggiISO()) ?? oggiISO(),
  )
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const mancanti = nonInterrogati(p.ordine, p.interrogati)
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
      await segnaInterrogati(db, p.r, elenco.filter((u) => scelti.has(u)), data, p.mioUid)
    } catch (e) {
      setErrore(messaggioErrore(e))
      setInCorso(false)
    }
  }

  const quanti = elenco.filter((u) => scelti.has(u)).length

  return (
    <Scheda titolo="Segna chi è stato interrogato">
      <div className="space-y-4 text-sm">
        <Etichetta testo="Lezione del">
          <input type="date" value={data} max={oggiISO()} onChange={(e) => setData(e.target.value)} className={`${CLASSE_INPUT} max-w-48`} />
        </Etichetta>
        <div className="space-y-1">
          <p>Probabilmente interrogati: togli la spunta a chi era assente (resterà in testa alla lista).</p>
          <ul className="space-y-1">
            {elenco.map((u) => (
              <li key={u}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scelti.has(u)}
                    onChange={(e) => cambia(u, e.target.checked)}
                    className="size-4 accent-accento"
                  />
                  {nome(u)}
                </label>
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
