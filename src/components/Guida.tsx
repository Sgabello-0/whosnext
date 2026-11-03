import { useState } from 'react'
import { db } from '../lib/firebase'
import { salvaCalendario, rifMaterie } from '../lib/configurazione'
import { messaggioErrore } from '../lib/errori'
import { useQuery } from '../lib/hooks'
import { messaggioInvito } from '../lib/messaggi'
import { useInterrogazioniOsservate } from '../lib/raccolta'
import { useCalendario } from '../lib/useCalendario'
import type { Materia } from '../lib/tipi'
import { useAvvisi } from './Avvisi'
import { Condividi } from './Condividi'
import { linkInvito } from './Invito'
import { Bottone, LinkBottone, Scheda } from './ui'
import { BookOpen, CalendarDays, Check, Rocket } from 'lucide-react'

function leggiNascosta(classId: string): boolean {
  try {
    return localStorage.getItem(`guida-nascosta/${classId}`) === '1'
  } catch {
    return false
  }
}

/** Passi per preparare una classe nuova; sparisce quando sono fatti tutti (o se la si nasconde). */
export function Guida(p: { classId: string; nomeClasse: string; codice: string; numeroMembri: number }) {
  const materie = useQuery<Materia>(db && rifMaterie(db, p.classId), `materie/${p.classId}`)
  const { cal, salvato } = useCalendario(p.classId)
  const interrogazioni = useInterrogazioniOsservate().filter((d) => d.classId === p.classId)
  const avvisi = useAvvisi()
  const [nascosta, setNascosta] = useState(() => leggiNascosta(p.classId))

  if (!materie.dati || !cal) return null
  const passi = [
    { fatto: materie.dati.some((m) => m.orario.length > 0), titolo: 'Aggiungi le materie e i loro giorni di lezione' },
    { fatto: salvato, titolo: 'Controlla il calendario (vacanze e giorni di scuola)' },
    { fatto: p.numeroMembri >= 2, titolo: 'Fai entrare i compagni' },
    { fatto: interrogazioni.length > 0, titolo: 'Crea la prima interrogazione' },
  ]
  const fatti = passi.filter((x) => x.fatto).length
  if (nascosta || fatti === passi.length) return null
  const prossimo = passi.findIndex((x) => !x.fatto)

  async function vaBene() {
    if (!db || !cal) return
    try {
      await salvaCalendario(db, p.classId, cal)
      avvisi.mostra('Calendario confermato')
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
    }
  }

  function nascondi() {
    try {
      localStorage.setItem(`guida-nascosta/${p.classId}`, '1')
    } catch {
      /* va bene anche solo per questa visita */
    }
    setNascosta(true)
  }

  return (
    <Scheda
      titolo={`Prepara la classe (${fatti} di ${passi.length})`}
      icona={Rocket}
      tono="evidenza"
      azioni={
        <button
          type="button"
          onClick={nascondi}
          className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Nascondi
        </button>
      }
    >
      <div aria-hidden className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className="h-full rounded-full bg-accento transition-all"
          style={{ width: `${(fatti / passi.length) * 100}%` }}
        />
      </div>
      <ol className="space-y-3" aria-label="Passi per preparare la classe">
        {passi.map((passo, i) => (
          <li key={passo.titolo} className="flex gap-3">
            <span
              aria-hidden
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                passo.fatto
                  ? 'bg-emerald-600 text-white'
                  : i === prossimo
                    ? 'bg-accento text-white'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {passo.fatto ? <Check className="size-4" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className={passo.fatto ? 'text-slate-500 line-through' : 'font-medium'}>
                {passo.titolo}
                <span className="sr-only">{passo.fatto ? ' (fatto)' : ' (da fare)'}</span>
              </p>
              {i === prossimo && i === 0 && (
                <LinkBottone to={`/classe/${p.classId}/configura`} variante="primario" icona={BookOpen}>
                  Aggiungi le materie
                </LinkBottone>
              )}
              {i === prossimo && i === 1 && (
                <div className="flex flex-wrap gap-2">
                  <LinkBottone
                    to={`/classe/${p.classId}/configura?sezione=calendario`}
                    variante="primario"
                    icona={CalendarDays}
                  >
                    Apri il calendario
                  </LinkBottone>
                  <Bottone variante="secondario" onClick={vaBene}>
                    Va bene così
                  </Bottone>
                </div>
              )}
              {i === prossimo && i === 2 && (
                <Condividi
                  titolo={`Unisciti a ${p.nomeClasse}`}
                  testo={messaggioInvito({ nomeClasse: p.nomeClasse, link: linkInvito(p.codice), codice: p.codice })}
                />
              )}
              {i === prossimo && i === 3 && (
                <p className="text-sm text-slate-500">Tocca "Nuova interrogazione" qui sotto.</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </Scheda>
  )
}
