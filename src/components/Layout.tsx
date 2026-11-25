import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { aggiornaPush } from '../lib/push'
import { Link, NavLink, useLocation } from 'react-router'
import { Hourglass, House, ListOrdered, LogOut, Settings } from 'lucide-react'
import { orderBy, query } from 'firebase/firestore'
import { useAuth } from '../lib/auth'
import { db, USA_EMULATORI } from '../lib/firebase'
import { queryMieIscrizioni, rifClasse } from '../lib/classi'
import { rifInterrogazioni, rifMaterie } from '../lib/configurazione'
import { useDocumento, useQuery, type ConId } from '../lib/hooks'
import type { Classe, Interrogazione, Materia, Membro } from '../lib/tipi'
import { useDesktop } from '../lib/useDesktop'
import { Avatar } from './ui'
import { Logo } from './Logo'
import { InstallaApp } from './InstallaApp'
import { ScatolaNotifiche } from './ScatolaNotifiche'

/** Quanto è "dentro" una pagina: home 0, classe 2, materia 4, interrogazione 6; le Impostazioni sempre sopra. */
function profondita(percorso: string): number {
  if (percorso.startsWith('/impostazioni')) return 100
  return percorso.split('/').filter(Boolean).length
}

/**
 * Direzione dell'animazione per la pagina appena aperta: da destra se si va più a fondo
 * (o nelle Impostazioni), da sinistra se si torna indietro. Nessuna al primo caricamento.
 */
function useDirezione(percorso: string): string {
  const ultima = useRef<{ percorso: string; classe: string } | null>(null)
  if (ultima.current === null) {
    ultima.current = { percorso, classe: '' }
  } else if (ultima.current.percorso !== percorso) {
    const prima = profondita(ultima.current.percorso)
    const dopo = profondita(percorso)
    ultima.current = {
      percorso,
      classe: dopo > prima ? 'pagina-avanti' : dopo < prima ? 'pagina-indietro' : 'pagina-uguale',
    }
  }
  return ultima.current.classe
}

/**
 * Quanto può essere larga la pagina sul computer: le dashboard (home, classe, interrogazione) tutta la larghezza,
 * impostazioni e gestione su due colonne, il resto come sul telefono.
 */
function larghezza(percorso: string): string {
  if (percorso === '/' || /^\/classe\/[^/]+\/?$/.test(percorso) || /\/interrogazione\//.test(percorso)) return 'lg:max-w-6xl'
  if (percorso.startsWith('/impostazioni') || /\/gestione\/?$/.test(percorso)) return 'lg:max-w-5xl'
  return ''
}

/** Sul computer: la barra a sinistra con la home, una sezione per classe con le sue materie e le impostazioni. */
function BarraLaterale() {
  const { profilo, esci } = useAuth()
  const iscrizioni = useQuery<Membro>(
    db && profilo ? queryMieIscrizioni(db, profilo.uid) : null,
    profilo ? `iscrizioni/${profilo.uid}` : null,
  )
  if (!profilo) return null
  const voce = ({ isActive }: { isActive: boolean }) =>
    `flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
      isActive
        ? 'bg-accento-chiaro text-accento dark:bg-blue-950 dark:text-blue-200'
        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
    }`
  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-2 py-3 pr-3 pl-5">
        <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight">
          <Logo />
          <span className="text-lg">
            Whos<span className="text-accento dark:text-blue-300">Next</span>
          </span>
        </Link>
        <ScatolaNotifiche laterale />
      </div>
      <nav aria-label="Menu principale" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
        <NavLink to="/" end className={voce}>
          <House aria-hidden className="size-4.5 shrink-0" />
          Home
        </NavLink>
        {iscrizioni.dati?.map((m) => (
          <SezioneClasse key={m.percorso} classId={m.percorso.split('/')[1]!} />
        ))}
        <div className="mt-auto pt-4">
          <NavLink to="/impostazioni" className={voce}>
            <Settings aria-hidden className="size-4.5 shrink-0" />
            Impostazioni
          </NavLink>
        </div>
      </nav>
      <div className="flex items-center gap-2.5 border-t border-slate-200/80 px-4 py-3 dark:border-slate-800">
        <Avatar nome={profilo.nome} foto={profilo.foto} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{profilo.nome}</span>
          <span className="block truncate text-xs text-slate-600 dark:text-slate-400">{profilo.email}</span>
        </span>
        <button
          type="button"
          onClick={esci}
          aria-label="Esci"
          title="Esci"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <LogOut aria-hidden className="size-4.5" />
        </button>
      </div>
    </aside>
  )
}

/** Le interrogazioni in corso di una materia: 'lista' se almeno una lista è pronta, 'raccolta' se si raccolgono le preferenze. */
type InCorso = 'lista' | 'raccolta' | null

/**
 * Una materia nella barra: è lei il pulsante. Quella aperta (anche dentro una sua interrogazione) è blu;
 * quelle con interrogazioni in corso sono in evidenza, con a destra il simbolo della lista pronta
 * (o la clessidra se si raccolgono ancora le preferenze); le altre restano più discrete.
 */
function VoceMateria(p: { classId: string; materia: ConId<Materia>; onInCorso: (id: string, s: InCorso) => void }) {
  const { classId, materia, onInCorso } = p
  // la stessa query della pagina della classe: Firestore la ascolta una volta sola
  const interrogazioni = useQuery<Interrogazione>(
    db && query(rifInterrogazioni(db, classId, materia.id), orderBy('creato', 'desc')),
    `interrogazioni/${classId}/${materia.id}`,
  )
  const liste = (interrogazioni.dati ?? []).filter((i) => i.stato === 'lista')
  const inCorso: InCorso = liste.length > 0 ? 'lista' : interrogazioni.dati?.some((i) => i.stato === 'raccolta') ? 'raccolta' : null
  useEffect(() => {
    onInCorso(materia.id, inCorso)
  }, [materia.id, inCorso, onInCorso])
  const descrizione =
    inCorso === 'lista' ? (liste.every((i) => i.senzaLista) ? 'interrogazione in corso' : 'lista pronta') : 'preferenze aperte'
  const Icona = inCorso === 'lista' ? ListOrdered : Hourglass
  return (
    <NavLink
      to={`/classe/${classId}/materia/${materia.id}`}
      className={({ isActive }) =>
        `flex min-w-0 items-center gap-2 rounded-xl py-1.5 pr-1.5 pl-3 text-sm transition ${
          isActive
            ? 'bg-accento-chiaro font-semibold text-accento ring-1 ring-accento/30 dark:bg-blue-950 dark:text-blue-200 dark:ring-blue-800'
            : inCorso
              ? 'bg-white font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 hover:ring-slate-300 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700 dark:hover:ring-slate-600'
              : 'font-medium text-slate-600 hover:bg-white/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
        }`
      }
    >
      <span className="min-w-0 flex-1 truncate py-0.5">{materia.nome}</span>
      {inCorso && (
        <span
          title={descrizione.charAt(0).toUpperCase() + descrizione.slice(1)}
          className={`flex size-6 shrink-0 items-center justify-center rounded-lg ${
            inCorso === 'lista'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
          }`}
        >
          <Icona aria-hidden className="size-3.5" />
          <span className="sr-only">, {descrizione}</span>
        </span>
      )}
    </NavLink>
  )
}

/** Una classe nella barra: un riquadro con il nome come titolo (solo testo) e sotto le materie, prima quelle in corso. */
function SezioneClasse({ classId }: { classId: string }) {
  const dati = useDocumento<Classe>(db && rifClasse(db, classId))
  const materie = useQuery<Materia>(db && rifMaterie(db, classId), `materie/${classId}`)
  const [inCorso, setInCorso] = useState<Record<string, InCorso>>({})
  const segna = useCallback((id: string, s: InCorso) => setInCorso((v) => (v[id] === s ? v : { ...v, [id]: s })), [])
  const nome = dati.dati?.nome ?? '…'
  const elenco = [...(materie.dati ?? [])].sort(
    (a, b) => Number(!inCorso[a.id]) - Number(!inCorso[b.id]) || a.nome.localeCompare(b.nome, 'it'),
  )
  const id = `barra-classe-${classId}`
  return (
    <div
      role="group"
      aria-labelledby={id}
      className="mt-3 flex flex-col gap-1 rounded-2xl bg-slate-100/80 p-1.5 ring-1 ring-slate-200/70 dark:bg-slate-900 dark:ring-slate-800"
    >
      <p id={id} className="truncate px-2 pt-1 pb-1 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-400">
        {nome}
      </p>
      {materie.dati && elenco.length === 0 && <p className="px-2 pb-1 text-sm text-slate-600 dark:text-slate-400">Nessuna materia</p>}
      {elenco.map((m) => (
        <VoceMateria key={m.id} classId={classId} materia={m} onInCorso={segna} />
      ))}
    </div>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profilo, esci } = useAuth()
  const { pathname } = useLocation()
  const animazione = useDirezione(pathname)
  // la barra laterale (con le sue letture dal database) solo sul computer
  const desktop = useDesktop()
  const uid = profilo?.uid
  useEffect(() => {
    // il token delle notifiche può cambiare nel tempo: lo si tiene aggiornato
    if (uid) aggiornaPush(uid).catch(() => undefined)
  }, [uid])
  return (
    <div className="min-h-dvh overflow-x-clip lg:pl-64">
      {/* sul computer la barra a sinistra prende il posto dell'intestazione */}
      {profilo && desktop && <BarraLaterale />}
      {USA_EMULATORI && (
        <p className="bg-amber-300 px-4 py-1 text-center text-xs font-semibold text-amber-950">
          Modalità prova (emulatore): i dati sono finti e restano solo su questo computer
        </p>
      )}
      <header className="sticky top-0 z-10 border-b lg:hidden border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <Link to="/" className="flex min-w-0 items-center gap-2.5 rounded-xl py-1 pr-2 font-bold tracking-tight">
            <Logo />
            <span className="truncate text-lg">
              Whos<span className="text-accento dark:text-blue-300">Next</span>
            </span>
          </Link>
          {profilo && (
            <div className="flex min-w-0 items-center gap-1">
              {!desktop && <ScatolaNotifiche />}
              <Link
                to="/impostazioni"
                aria-label="Impostazioni"
                title="Impostazioni"
                className="flex min-w-0 items-center gap-2 rounded-full py-0.5 pr-0.5 pl-2 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <span className="hidden max-w-48 truncate text-sm text-slate-600 sm:inline dark:text-slate-300">
                  {profilo.nome}
                </span>
                <span className="relative">
                  <Avatar nome={profilo.nome} foto={profilo.foto} />
                  <span
                    aria-hidden
                    className="absolute -right-1 -bottom-1 flex size-4 items-center justify-center rounded-full bg-white text-slate-600 shadow ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                  >
                    <Settings className="size-2.5" />
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={esci}
                className="ml-1 inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <LogOut aria-hidden className="size-4" />
                Esci
              </button>
            </div>
          )}
        </div>
      </header>
      <main className={`mx-auto max-w-3xl px-4 pt-5 pb-24 sm:pt-6 lg:px-8 lg:pt-8 ${larghezza(pathname)}`}>
        {/* una pagina nuova a ogni percorso: così parte la sua animazione d'entrata */}
        <div key={pathname} className={`flex flex-col gap-4 sm:gap-5 ${animazione}`}>
          {children}
        </div>
      </main>
      {profilo && <InstallaApp />}
    </div>
  )
}
