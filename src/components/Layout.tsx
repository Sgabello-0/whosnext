import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { LogOut, Settings } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { USA_EMULATORI } from '../lib/firebase'
import { Avatar } from './ui'
import { Logo } from './Logo'
import { InstallaApp } from './InstallaApp'

export default function Layout({ children }: { children: ReactNode }) {
  const { profilo, esci } = useAuth()
  return (
    <div className="min-h-dvh">
      {USA_EMULATORI && (
        <p className="bg-amber-300 px-4 py-1 text-center text-xs font-semibold text-amber-950">
          Modalità prova (emulatore): i dati sono finti e restano solo su questo computer
        </p>
      )}
      <header className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
          <Link
            to="/"
            className="flex min-w-0 items-center gap-2.5 rounded-xl py-1 pr-2 font-bold tracking-tight"
          >
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
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-5 pb-24 sm:gap-5 sm:pt-6">{children}</main>
      {profilo && <InstallaApp />}
    </div>
  )
}
