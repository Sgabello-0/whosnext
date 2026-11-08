import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { formattaGiorno, momentoLocale, oggiISO } from '../../lib/calendar'
import { caselleMese, nomiBrevi, spostaMese, vociPerGiorno, type VoceGiorno } from '../../lib/calendarioMese'
import { percorsoInterrogazione } from '../../lib/messaggi'
import { useInterrogazioniOsservate } from '../../lib/raccolta'
import { useAdesso } from '../../lib/useAdesso'
import { useDesktop } from '../../lib/useDesktop'
import { BottoneIcona, Scheda } from '../ui'

const INTESTAZIONI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function percorso(v: VoceGiorno): string {
  return percorsoInterrogazione(v.classId, v.subjectId, v.interrogazioneId)
}

function titoloMese(anno: number, mese: number): string {
  const t = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(new Date(anno, mese, 1))
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Chi tocca quel giorno: "tu" in evidenza, chi è già stato interrogato barrato. */
function Persone({ v, brevi }: { v: VoceGiorno; brevi: boolean }) {
  const nomi = brevi ? nomiBrevi(v.persone.map((p) => p.nome)) : v.persone.map((p) => p.nome)
  return (
    <>
      {v.persone.map((p, i) => (
        <span key={p.uid}>
          {i > 0 && ', '}
          <span className={`${p.io ? 'font-bold' : ''} ${p.fatto ? 'line-through opacity-70' : ''}`}>{p.io ? 'Tu' : nomi[i]}</span>
        </span>
      ))}
    </>
  )
}

/** Il mese intero, con tutte le interrogazioni previste. I giorni in cui tocca a chi guarda sono evidenziati. */
export function CalendarioInterrogazioni() {
  const adesso = useAdesso()
  const osservate = useInterrogazioniOsservate()
  const desktop = useDesktop()
  const oggi = oggiISO(adesso)
  const [mese, setMese] = useState({ anno: adesso.getFullYear(), mese: adesso.getMonth() })
  const giorni = vociPerGiorno(osservate, momentoLocale(adesso))
  if (giorni.size === 0) return null

  const caselle = caselleMese(mese.anno, mese.mese)
  const delMese = caselle.filter((d): d is string => !!d && giorni.has(d))
  const navigazione = (
    <div className="flex items-center gap-1">
      <BottoneIcona icona={ChevronLeft} etichetta="Mese precedente" onClick={() => setMese((m) => spostaMese(m, -1))} />
      <span className="min-w-36 text-center text-sm font-semibold" aria-live="polite">
        {titoloMese(mese.anno, mese.mese)}
      </span>
      <BottoneIcona icona={ChevronRight} etichetta="Mese successivo" onClick={() => setMese((m) => spostaMese(m, 1))} />
    </div>
  )

  return (
    <Scheda
      titolo="Calendario delle interrogazioni"
      icona={CalendarDays}
      sottotitolo="In evidenza i giorni in cui tocca a te. Le date sono stimate e si aggiornano da sole."
      azioni={navigazione}
    >
      {desktop ? (
        <div role="group" aria-label={`Calendario di ${titoloMese(mese.anno, mese.mese)}`} className="grid grid-cols-7 gap-1.5">
          {INTESTAZIONI.map((g) => (
            <div key={g} aria-hidden className="pb-1 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">
              {g}
            </div>
          ))}
          {caselle.map((d, i) => {
            if (!d) return <div key={`vuota-${i}`} aria-hidden />
            const voci = giorni.get(d) ?? []
            const mio = voci.some((v) => v.mia)
            return (
              <div
                key={d}
                role="group"
                aria-label={formattaGiorno(d)}
                className={`min-h-24 min-w-0 rounded-xl border p-1.5 ${
                  mio
                    ? 'border-accento bg-accento-chiaro ring-1 ring-accento dark:bg-blue-950/70'
                    : 'border-slate-200/80 dark:border-slate-800'
                }`}
              >
                <span
                  className={`mb-1 flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                    d === oggi ? 'bg-accento text-white' : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                <ul className="space-y-1">
                  {voci.map((v) => (
                    <li key={v.chiave}>
                      <Link
                        to={percorso(v)}
                        title={`${v.classe} · ${v.materia} – ${v.interrogazione}: ${v.persone.map((p) => p.nome).join(', ')}`}
                        className="block rounded-md px-1 py-0.5 text-xs leading-tight hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="block truncate font-semibold">{v.materia}</span>
                        <span className="block text-slate-700 dark:text-slate-300">
                          <Persone v={v} brevi />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      ) : delMese.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Nessuna interrogazione prevista in questo mese.</p>
      ) : (
        <ol className="space-y-2" aria-label={`Agenda di ${titoloMese(mese.anno, mese.mese)}`}>
          {delMese.map((d) => {
            const voci = giorni.get(d)!
            const mio = voci.some((v) => v.mia)
            return (
              <li
                key={d}
                className={`rounded-xl border p-2.5 ${mio ? 'border-accento bg-accento-chiaro dark:bg-blue-950/70' : 'border-slate-200/80 dark:border-slate-800'}`}
              >
                <p className="mb-1 text-sm font-semibold">
                  {formattaGiorno(d)}
                  {d === oggi && ' · oggi'}
                </p>
                <ul className="space-y-1">
                  {voci.map((v) => (
                    <li key={v.chiave}>
                      <Link to={percorso(v)} className="block text-sm">
                        <span className="font-medium">
                          {v.materia} – {v.interrogazione}
                        </span>
                        <span className="block text-slate-700 dark:text-slate-300">
                          <Persone v={v} brevi={false} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ol>
      )}
    </Scheda>
  )
}
