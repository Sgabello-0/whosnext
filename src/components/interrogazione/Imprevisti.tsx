import { useState } from 'react'
import { CalendarCheck, CalendarX, LifeBuoy, ListPlus, UserMinus } from 'lucide-react'
import { db } from '../../lib/firebase'
import { formattaGiorno } from '../../lib/calendar'
import { messaggioErrore } from '../../lib/errori'
import { gestisciImprevisto, type Imprevisto } from '../../lib/gestioneLista'
import { statoInLista, type Composizione } from '../../lib/lista'
import type { Membro } from '../../lib/tipi'
import { useAvvisi } from '../Avvisi'
import { useConferma } from '../Conferma'
import { Avatar, Badge, Bottone, CLASSE_INPUT, Soffietto } from '../ui'

type Rif = { classId: string; subjectId: string; interrogazioneId: string }

/**
 * Imprevisti (solo capo e vice): chi è fuori dalla lista si rimette in fondo, a chiunque si può fissare
 * una data (o toglierla), e chi non deve più esserci si toglie. Ogni modifica finisce nello storico.
 */
export function Imprevisti(p: {
  r: Rif
  composizione: Composizione
  /** tutti i membri della classe (servono i nomi) */
  membri: Map<string, Membro>
  mioUid: string
  /** le date tra cui scegliere per fissare un'interrogazione */
  date: string[]
  /** senza lista: niente numeri */
  senzaLista?: boolean
}) {
  const avvisi = useAvvisi()
  const conferma = useConferma()
  const [inData, setInData] = useState<string | null>(null)
  const [giorno, setGiorno] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const c = p.composizione
  const nome = (uid: string) => p.membri.get(uid)?.nome ?? 'Ex membro'

  // studenti della classe + chi è ancora in lista ma non è più della classe
  const studenti = [...p.membri.values()].filter((m) => m.ruolo !== 'docente').map((m) => m.uid)
  const ex = [...c.ordine, ...Object.keys(c.fissi)].filter((u) => !p.membri.has(u))
  const persone = [...new Set([...studenti, ...ex])].sort((a, b) => nome(a).localeCompare(nome(b), 'it'))
  const fuori = persone.filter((u) => statoInLista(c, u) === 'fuori').length
  // aperto all'inizio se c'è qualcuno fuori lista; poi lo decide chi lo usa
  const [aperto] = useState(fuori > 0)

  async function esegui(i: Imprevisto, avviso: string, annulla?: Imprevisto) {
    if (!db) return
    const d = db
    setInCorso(true)
    try {
      await gestisciImprevisto(d, p.r, i, p.mioUid)
      setInData(null)
      avvisi.mostra(avviso, annulla ? { annulla: () => gestisciImprevisto(d, p.r, annulla, p.mioUid) } : undefined)
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  async function togli(uid: string) {
    const ok = await conferma({
      titolo: `Togliere ${nome(uid)} dalla lista?`,
      testo: `Perde il suo posto${c.interrogati[uid] ? ' e il segno di interrogato' : ''}. Potrai rimetterlo, ma in fondo alla lista.`,
      pulsante: 'Togli dalla lista',
      pericolo: true,
    })
    if (ok) await esegui({ tipo: 'togli', uid }, `${nome(uid)} tolto dalla lista`, { tipo: 'aggiungi', uid })
  }

  function apriData(uid: string) {
    setInData(uid)
    setGiorno(c.fissi[uid] && p.date.includes(c.fissi[uid]!) ? c.fissi[uid]! : (p.date[0] ?? ''))
  }

  return (
    <Soffietto
      titolo={`Imprevisti: aggiungi, togli, fissa una data${fuori > 0 ? ` (${fuori} fuori lista)` : ''}`}
      icona={LifeBuoy}
      aperto={aperto}
    >
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        Per chi è entrato in classe dopo, chi era stato escluso, chi deve essere interrogato in un giorno preciso o chi non
        deve più esserci. Lo vedono e lo usano solo capoclasse e vice; ogni modifica resta nello storico.
      </p>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800" aria-label="Persone e lista">
        {persone.map((uid) => {
          const dove = statoInLista(c, uid)
          const m = p.membri.get(uid)
          const fatto = !!c.interrogati[uid]
          const n = nome(uid)
          return (
            <li key={uid} className="space-y-2 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Avatar nome={n} foto={m?.foto ?? null} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{n}</span>
                  <span className="block text-xs text-slate-600 dark:text-slate-400">
                    {fatto
                      ? 'già interrogato'
                      : dove === 'ordine'
                        ? p.senzaLista
                          ? 'da interrogare'
                          : `in lista, n° ${c.ordine.indexOf(uid) + 1}`
                        : dove === 'fissa'
                          ? `data fissa: ${formattaGiorno(c.fissi[uid]!).toLowerCase()}`
                          : 'fuori dalla lista'}
                  </span>
                </span>
                {!m && <Badge colore="grigio">non più in classe</Badge>}
                <span className="flex flex-wrap gap-1.5">
                  {dove === 'fuori' && m && (
                    <Bottone
                      variante="piccolo"
                      icona={ListPlus}
                      aria-label={`Aggiungi in fondo ${n}`}
                      disabled={inCorso}
                      onClick={() => esegui({ tipo: 'aggiungi', uid }, `${n} aggiunto in fondo alla lista`, { tipo: 'togli', uid })}
                    >
                      Aggiungi in fondo
                    </Bottone>
                  )}
                  {dove === 'fissa' && !fatto && (
                    <Bottone
                      variante="piccolo"
                      icona={CalendarX}
                      aria-label={`Rimetti in lista ${n}`}
                      disabled={inCorso}
                      onClick={() =>
                        esegui({ tipo: 'aggiungi', uid }, `${n} di nuovo in lista, in fondo`, { tipo: 'fissa', uid, data: c.fissi[uid]! })
                      }
                    >
                      Rimetti in lista
                    </Bottone>
                  )}
                  {m && !fatto && p.date.length > 0 && (
                    <Bottone
                      variante="piccolo"
                      icona={CalendarCheck}
                      aria-label={`${dove === 'fissa' ? 'Cambia data' : 'Fissa una data'} ${n}`}
                      disabled={inCorso}
                      onClick={() => apriData(uid)}
                    >
                      {dove === 'fissa' ? 'Cambia data' : 'Fissa una data'}
                    </Bottone>
                  )}
                  {dove !== 'fuori' && (
                    <Bottone variante="piccolo" icona={UserMinus} aria-label={`Togli dalla lista ${n}`} disabled={inCorso} onClick={() => togli(uid)}>
                      Togli
                    </Bottone>
                  )}
                </span>
              </div>
              {inData === uid && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2 dark:bg-slate-800/60">
                  <select
                    aria-label={`Giorno dell'interrogazione di ${n}`}
                    value={giorno}
                    onChange={(e) => setGiorno(e.target.value)}
                    className={`${CLASSE_INPUT} max-w-56 py-1.5`}
                  >
                    {p.date.map((d) => (
                      <option key={d} value={d}>
                        {formattaGiorno(d)}
                      </option>
                    ))}
                  </select>
                  <Bottone
                    variante="piccolo"
                    disabled={inCorso || !giorno}
                    onClick={() => {
                      const prima = c.fissi[uid]
                      const annulla: Imprevisto =
                        dove === 'fissa' && prima
                          ? { tipo: 'fissa', uid, data: prima }
                          : dove === 'ordine'
                            ? { tipo: 'aggiungi', uid } // torna in lista (in fondo)
                            : { tipo: 'togli', uid }
                      void esegui({ tipo: 'fissa', uid, data: giorno }, `${n}: interrogazione fissata per ${formattaGiorno(giorno).toLowerCase()}`, annulla)
                    }}
                  >
                    Fissa
                  </Bottone>
                  <Bottone variante="piccolo" onClick={() => setInData(null)}>
                    Annulla
                  </Bottone>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </Soffietto>
  )
}
