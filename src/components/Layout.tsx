import { useEffect, useRef, type ReactNode } from 'react'
import { aggiornaPush } from '../lib/push'
import { Link, NavLink, useLocation } from 'react-router'
import { House, LogOut, Settings } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { db, USA_EMULATORI } from '../lib/firebase'
import { queryMieIscrizioni, rifClasse } from '../lib/classi'
import { useDocumento, useQuery } from '../lib/hooks'
import type { Classe, Membro } from '../lib/tipi'
import { useDesktop } from '../lib/useDesktop'
import { Avatar } from './ui'
import { Logo } from './Logo'
import { InstallaApp } from './InstallaApp'

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

/** Sul computer: la barra a sinistra con la home, le proprie classi e le impostazioni. */
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
      <Link to="/" className="flex items-center gap-2.5 px-5 py-4 font-bold tracking-tight">
        <Logo />
        <span className="text-lg">
          Whos<span className="text-accento dark:text-blue-300">Next</span>
        </span>
      </Link>
      <nav aria-label="Menu principale" className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
        <NavLink to="/" end className={voce}>
          <House aria-hidden className="size-4.5 shrink-0" />
          Home
        </NavLink>
        {iscrizioni.dati && iscrizioni.dati.length > 0 && (
          <>
            <p className="mt-4 mb-1 px-3 text-xs font-semibold tracking-wide text-slate-600 uppercase dark:text-slate-400">
              Le tue classi
            </p>
            {iscrizioni.dati.map((m) => (
              <VoceClasse key={m.percorso} classId={m.percorso.split('/')[1]!} classe={voce} />
            ))}
          </>
        )}
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

function VoceClasse({ classId, classe }: { classId: string; classe: (s: { isActive: boolean }) => string }) {
  const dati = useDocumento<Classe>(db && rifClasse(db, classId))
  const nome = dati.dati?.nome ?? '…'
  return (
    <NavLink to={`/classe/${classId}`} className={classe}>
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        {nome.slice(0, 2)}
      </span>
      <span className="truncate">{nome}</span>
    </NavLink>
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
