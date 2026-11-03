import type { ReactNode } from 'react'
import { Link } from 'react-router'

type Tono = 'ok' | 'errore' | 'avviso' | 'info'

const STILI_RIQUADRO: Record<Tono, string> = {
  ok: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100',
  errore: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100',
  avviso: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100',
  info: 'border-blue-200 bg-accento-chiaro text-slate-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-50',
}

export function Riquadro(props: { tono: Tono; titolo?: string; children?: ReactNode }) {
  return (
    <div
      role={props.tono === 'errore' ? 'alert' : 'status'}
      className={`rounded-xl border p-4 text-sm ${STILI_RIQUADRO[props.tono]}`}
    >
      {props.titolo && <p className="mb-1 font-semibold">{props.titolo}</p>}
      {props.children}
    </div>
  )
}

const BASE_BOTTONE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accento disabled:cursor-not-allowed disabled:opacity-60'

const STILI_BOTTONE = {
  primario: 'bg-accento text-white hover:bg-blue-700',
  secondario:
    'border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  pericolo:
    'border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950',
  piccolo:
    'border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
}

export function Bottone(props: {
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  variante?: keyof typeof STILI_BOTTONE
  larga?: boolean
  children: ReactNode
  'aria-label'?: string
}) {
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props['aria-label']}
      className={`${BASE_BOTTONE} ${STILI_BOTTONE[props.variante ?? 'primario']} ${props.larga ? 'w-full' : ''}`}
    >
      {props.children}
    </button>
  )
}

export function LinkBottone(props: { to: string; variante?: keyof typeof STILI_BOTTONE; children: ReactNode }) {
  return (
    <Link to={props.to} className={`${BASE_BOTTONE} ${STILI_BOTTONE[props.variante ?? 'secondario']}`}>
      {props.children}
    </Link>
  )
}

export function Scheda(props: { titolo?: ReactNode; azioni?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900">
      {(props.titolo || props.azioni) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {props.titolo && <h2 className="text-lg font-semibold">{props.titolo}</h2>}
          {props.azioni}
        </div>
      )}
      {props.children}
    </section>
  )
}

const STILI_BADGE = {
  blu: 'bg-blue-100 text-blue-900 dark:bg-blue-900/60 dark:text-blue-100',
  viola: 'bg-violet-100 text-violet-900 dark:bg-violet-900/60 dark:text-violet-100',
  verde: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100',
  ambra: 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-100',
  grigio: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

export function Badge(props: { colore?: keyof typeof STILI_BADGE; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STILI_BADGE[props.colore ?? 'grigio']}`}
    >
      {props.children}
    </span>
  )
}

export function Avatar(props: { nome: string; foto: string | null; grande?: boolean }) {
  const dim = props.grande ? 'size-10' : 'size-8'
  if (props.foto) {
    return (
      <img
        src={props.foto}
        alt=""
        referrerPolicy="no-referrer"
        className={`${dim} shrink-0 rounded-full bg-slate-200 object-cover dark:bg-slate-700`}
      />
    )
  }
  const iniziali = props.nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return (
    <span
      aria-hidden
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full bg-accento-chiaro text-xs font-semibold text-accento dark:bg-blue-950 dark:text-blue-200`}
    >
      {iniziali || '?'}
    </span>
  )
}

export function Caricamento(props: { testo?: string }) {
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-slate-500" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-accento" aria-hidden />
      {props.testo ?? 'Caricamento…'}
    </p>
  )
}

export function Campo(props: {
  etichetta: string
  valore: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  autoComplete?: string
  aiuto?: string
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{props.etichetta}</span>
      <input
        value={props.valore}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        autoComplete={props.autoComplete ?? 'off'}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-accento focus:ring-2 focus:ring-accento/30 dark:border-slate-700 dark:bg-slate-950"
      />
      {props.aiuto && <span className="block text-xs text-slate-500">{props.aiuto}</span>}
    </label>
  )
}

export const CLASSE_INPUT =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-accento focus:ring-2 focus:ring-accento/30 dark:border-slate-700 dark:bg-slate-950'

/** Etichetta con un controllo qualsiasi dentro (input, select, textarea). */
export function Etichetta(props: { testo: string; aiuto?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{props.testo}</span>
      {props.children}
      {props.aiuto && <span className="block text-xs text-slate-500">{props.aiuto}</span>}
    </label>
  )
}

/** Pulsanti lun–sab da accendere e spegnere. */
export function SelettoreGiorni(props: {
  valore: number[]
  onChange: (giorni: number[]) => void
  etichetta: string
  giorni?: readonly number[]
}) {
  const nomi = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']
  const nomiLunghi = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
  const elenco = props.giorni ?? [0, 1, 2, 3, 4, 5]
  return (
    <fieldset className="space-y-1 text-sm">
      <legend className="font-medium">{props.etichetta}</legend>
      <div className="flex flex-wrap gap-1.5">
        {elenco.map((g) => {
          const attivo = props.valore.includes(g)
          return (
            <button
              key={g}
              type="button"
              aria-pressed={attivo}
              aria-label={nomiLunghi[g]}
              onClick={() => props.onChange(attivo ? props.valore.filter((x) => x !== g) : [...props.valore, g].sort())}
              className={`min-w-12 rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accento ${
                attivo
                  ? 'border-accento bg-accento text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {nomi[g]}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
