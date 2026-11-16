import { useState, type FormEvent } from 'react'
import { CalendarX, Plus, X } from 'lucide-react'
import { db } from '../lib/firebase'
import { avvisaServer } from '../lib/avvisaServer'
import {
  ETICHETTA_MOTIVO,
  formattaGiorno,
  MOTIVI_NON_INTERROGA,
  oggiISO,
  prossimeLezioni,
  type Calendario,
  type EccezioneLezione,
  type MotivoNonInterroga,
} from '../lib/calendar'
import { segnaGiornoSenzaInterrogazioni, togliGiornoSenzaInterrogazioni } from '../lib/configurazione'
import { messaggioErrore } from '../lib/errori'
import { gestisceMateria, puoGestireDSA } from '../lib/membri'
import type { Membro } from '../lib/tipi'
import { useAvvisi } from './Avvisi'
import { Bottone, CLASSE_INPUT, Etichetta, Riquadro, Scheda } from './ui'

/**
 * I giorni in cui la materia non interroga (spiegazione, verifica…): non contano per le date delle liste.
 * Li vedono tutti; li segnano capoclasse, vice e il docente della materia (al capoclasse arriva una notifica).
 */
export function GiorniSenzaInterrogazioni(p: {
  classId: string
  subjectId: string
  giorni: number[]
  cal: Calendario
  io: Membro
  membri: Membro[]
}) {
  const puo = gestisceMateria(p.io, p.subjectId)
  const staff = puoGestireDSA(p.io)
  const oggi = oggiISO()
  const voci = p.cal.eccezioni.filter(
    (e): e is EccezioneLezione => e.tipo !== 'vacanza' && e.subjectId === p.subjectId && e.data >= oggi,
  )
  if (!puo && voci.length === 0) return null
  const nome = (uid?: string) => (uid && p.membri.find((m) => m.uid === uid)?.nome) || null

  return (
    <Scheda
      titolo="Giorni senza interrogazioni"
      icona={CalendarX}
      sottotitolo={puo ? 'Spiegazione, verifica o altro: quel giorno non si interroga e le date delle liste passano alla lezione dopo.' : undefined}
    >
      <div className="space-y-4">
        {voci.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Nessuno.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800" aria-label="Giorni senza interrogazioni">
            {voci.map((e) => (
              <RigaGiorno key={`${e.tipo}|${e.data}`} classId={p.classId} e={e} chi={nome(e.chi)} puoTogliere={staff || (puo && e.tipo === 'lezione-annullata')} />
            ))}
          </ul>
        )}
        {puo && <NuovoGiorno {...p} oggi={oggi} giaSegnati={voci.map((e) => e.data)} staff={staff} />}
      </div>
    </Scheda>
  )
}

function RigaGiorno(p: { classId: string; e: EccezioneLezione; chi: string | null; puoTogliere: boolean }) {
  const avvisi = useAvvisi()
  const [inCorso, setInCorso] = useState(false)
  const giorno = formattaGiorno(p.e.data)
  const cosa = p.e.tipo === 'lezione-extra' ? 'Lezione extra' : p.e.motivo ? ETICHETTA_MOTIVO[p.e.motivo] : 'Niente interrogazioni'

  async function togli() {
    if (!db) return
    const d = db
    setInCorso(true)
    try {
      await togliGiornoSenzaInterrogazioni(d, p.classId, p.e)
      avvisi.mostra(`${giorno}: tolto`)
    } catch (err) {
      avvisi.errore(messaggioErrore(err))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <span>
        <span className="font-medium">{giorno}</span> · {cosa}
        {p.chi && <span className="block text-xs text-slate-600 dark:text-slate-400">Segnato da {p.chi}</span>}
      </span>
      {p.puoTogliere && (
        <Bottone variante="piccolo" icona={X} aria-label={`Togli ${giorno}`} disabled={inCorso} onClick={togli}>
          Togli
        </Bottone>
      )}
    </li>
  )
}

function NuovoGiorno(p: {
  classId: string
  subjectId: string
  giorni: number[]
  cal: Calendario
  io: Membro
  oggi: string
  giaSegnati: string[]
  staff: boolean
}) {
  const avvisi = useAvvisi()
  // le prossime lezioni della materia (quelle già senza interrogazioni non ci sono più)
  const lezioni = prossimeLezioni({ giorni: p.giorni, subjectId: p.subjectId, cal: p.cal, da: p.oggi, quante: 30 }).filter(
    (d) => !p.giaSegnati.includes(d),
  )
  const [data, setData] = useState('')
  const [motivo, setMotivo] = useState<MotivoNonInterroga>('spiegazione')
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const scelta = lezioni.includes(data) ? data : (lezioni[0] ?? '')

  async function invia(ev: FormEvent) {
    ev.preventDefault()
    if (!db || !scelta) return
    const d = db
    setInCorso(true)
    setErrore(null)
    try {
      const e = await segnaGiornoSenzaInterrogazioni(d, p.classId, { data: scelta, subjectId: p.subjectId, motivo, chi: p.io.uid }, p.staff)
      // se lo segna il docente, il capoclasse riceve una notifica
      if (p.io.ruolo === 'docente') avvisaServer('non-interroga', { classId: p.classId, subjectId: p.subjectId }, scelta)
      avvisi.mostra(`${formattaGiorno(scelta)}: niente interrogazioni`, {
        annulla: () => togliGiornoSenzaInterrogazioni(d, p.classId, e),
      })
      setData('')
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setInCorso(false)
    }
  }

  if (lezioni.length === 0) {
    return <p className="text-sm text-slate-600 dark:text-slate-400">Non ci sono altre lezioni di questa materia fino a fine anno.</p>
  }
  return (
    <form onSubmit={invia} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 sm:p-4 dark:bg-slate-950/50">
      <p className="font-semibold sm:col-span-2">Segna un giorno</p>
      <Etichetta testo="Lezione">
        <select value={scelta} onChange={(e) => setData(e.target.value)} className={CLASSE_INPUT}>
          {lezioni.map((d) => (
            <option key={d} value={d}>
              {formattaGiorno(d)}
            </option>
          ))}
        </select>
      </Etichetta>
      <Etichetta testo="Motivo">
        <select value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoNonInterroga)} className={CLASSE_INPUT}>
          {MOTIVI_NON_INTERROGA.map((m) => (
            <option key={m} value={m}>
              {ETICHETTA_MOTIVO[m]}
            </option>
          ))}
        </select>
      </Etichetta>
      {errore && (
        <div className="sm:col-span-2">
          <Riquadro tono="errore">{errore}</Riquadro>
        </div>
      )}
      <div className="sm:col-span-2">
        <Bottone type="submit" icona={Plus} disabled={inCorso || !scelta}>
          Niente interrogazioni quel giorno
        </Bottone>
      </div>
    </form>
  )
}
