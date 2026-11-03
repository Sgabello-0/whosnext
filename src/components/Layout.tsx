import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../lib/auth'
import { USA_EMULATORI } from '../lib/firebase'
import { Avatar } from './ui'

export default function Layout({ children }: { children: ReactNode }) {
  const { profilo, esci } = useAuth()
  return (
    <div className="min-h-dvh">
      {USA_EMULATORI && (
        <p className="bg-amber-300 px-4 py-1 text-center text-xs font-semibold text-amber-950">
          Modalità prova (emulatore): i dati sono finti e restano solo su questo computer
        </p>
      )}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="font-semibold text-accento dark:text-blue-300">
            Interrogazioni di Classe
          </Link>
          {profilo && (
            <div className="flex min-w-0 items-center gap-2">
              <Avatar nome={profilo.nome} foto={profilo.foto} />
              <span className="hidden truncate text-sm sm:inline">{profilo.nome}</span>
              <button
                type="button"
                onClick={esci}
                className="rounded-md px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Esci
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">{children}</main>
    </div>
  )
}
