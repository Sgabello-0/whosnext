import { useState } from 'react'
import { db } from '../lib/firebase'
import { NOMI_GIORNI, NOMI_GIORNI_BREVI, type Calendario } from '../lib/calendar'
import { aggiornaOrari } from '../lib/configurazione'
import { messaggioErrore } from '../lib/errori'
import type { ConId } from '../lib/hooks'
import type { Materia } from '../lib/tipi'
import { useAvvisi } from './Avvisi'
import { Bottone, Scheda } from './ui'
import { Grid3x3 } from 'lucide-react'

/** Orario settimanale a griglia: materie × giorni di scuola, salvato tutto insieme. */
export function OrarioSettimanale({ classId, materie, cal }: { classId: string; materie: ConId<Materia>[]; cal: Calendario }) {
  const avvisi = useAvvisi()
  const [modifiche, setModifiche] = useState<Record<string, number[]>>({})
  const [inCorso, setInCorso] = useState(false)
  // Le colonne sono i giorni di scuola (più eventuali giorni già usati da qualche materia)
  const giorni = [0, 1, 2, 3, 4, 5].filter((g) => cal.giorniScolastici[g] || materie.some((m) => m.orario.includes(g)))
  const orario = (m: ConId<Materia>) => modifiche[m.id] ?? m.orario

  function cambia(m: ConId<Materia>, g: number, attivo: boolean) {
    const attuale = orario(m)
    const nuovo = attivo ? [...attuale, g].sort() : attuale.filter((x) => x !== g)
    setModifiche((prima) => ({ ...prima, [m.id]: nuovo }))
  }

  const cambiate = materie.filter((m) => {
    const nuovo = modifiche[m.id]
    return nuovo && [...nuovo].sort().join() !== [...m.orario].sort().join()
  })

  async function salva() {
    if (!db) return
    const d = db
    const prima = cambiate.map((m) => ({ subjectId: m.id, orario: m.orario }))
    setInCorso(true)
    try {
      await aggiornaOrari(d, classId, cambiate.map((m) => ({ subjectId: m.id, orario: modifiche[m.id]! })))
      setModifiche({})
      avvisi.mostra('Orario salvato', { annulla: () => aggiornaOrari(d, classId, prima) })
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  if (materie.length === 0) return null

  return (
    <Scheda titolo="Orario settimanale" icona={Grid3x3} sottotitolo="Spunta i giorni di lezione di ogni materia.">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-1.5 pr-2 text-left font-medium text-slate-500">Materia</th>
              {giorni.map((g) => (
                <th key={g} scope="col" className="px-1 py-1.5 text-center font-medium text-slate-500" title={NOMI_GIORNI[g]}>
                  {NOMI_GIORNI_BREVI[g]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {materie.map((m) => (
              <tr key={m.id} className="border-t border-slate-200 dark:border-slate-800">
                <th scope="row" className="max-w-32 truncate py-2 pr-2 text-left font-medium">
                  {m.nome}
                </th>
                {giorni.map((g) => (
                  <td key={g} className="px-1 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label={`${m.nome} ${(NOMI_GIORNI[g] ?? '').toLowerCase()}`}
                      checked={orario(m).includes(g)}
                      onChange={(e) => cambia(m, g, e.target.checked)}
                      className="size-5 accent-accento"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Bottone onClick={salva} disabled={inCorso || cambiate.length === 0}>
          {inCorso ? 'Salvataggio…' : 'Salva orario'}
        </Bottone>
        {cambiate.length > 0 && (
          <Bottone variante="secondario" onClick={() => setModifiche({})} disabled={inCorso}>
            Annulla modifiche
          </Bottone>
        )}
      </div>
    </Scheda>
  )
}
