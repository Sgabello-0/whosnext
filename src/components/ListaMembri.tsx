import type { ReactNode } from 'react'
import type { Membro } from '../lib/tipi'
import { Avatar, Badge } from './ui'

/** Elenco di membri con i loro badge; `azioni` aggiunge pulsanti a destra (pagina di gestione). */
export function ListaMembri(props: {
  membri: Membro[]
  mioUid: string
  /** uid con badge DSA/BES da mostrare */
  dsa: Set<string>
  mostraEmail?: boolean
  azioni?: (m: Membro) => ReactNode
}) {
  if (props.membri.length === 0) return <p className="text-sm text-slate-500">Nessuno.</p>
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {props.membri.map((m) => (
        <li key={m.uid} className="flex flex-wrap items-center gap-x-3 gap-y-2.5 py-3">
          <Avatar nome={m.nome} foto={m.foto} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-medium">{m.nome}</span>
              {m.uid === props.mioUid && <Badge>tu</Badge>}
              {m.ruolo === 'capo' && <Badge colore="blu">Capoclasse</Badge>}
              {m.ruolo === 'vice' && <Badge colore="blu">Vice</Badge>}
              {props.dsa.has(m.uid) && <Badge colore="ambra">DSA/BES</Badge>}
              {m.ruolo === 'docente' && m.permessoModifica && <Badge colore="verde">Può modificare</Badge>}
              {m.ruolo === 'docente' && m.richiestaPermesso && <Badge colore="viola">Chiede il permesso</Badge>}
            </p>
            {props.mostraEmail && <p className="truncate text-xs text-slate-500">{m.email}</p>}
          </div>
          {props.azioni && <div className="flex basis-full flex-wrap gap-1.5 pl-11 sm:basis-auto sm:pl-0">{props.azioni(m)}</div>}
        </li>
      ))}
    </ul>
  )
}
