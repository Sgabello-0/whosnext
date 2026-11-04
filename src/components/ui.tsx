import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'

type Tono = 'ok' | 'errore' | 'avviso' | 'info'

const STILI_RIQUADRO: Record<Tono, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100',
  errore: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-100',
  avviso: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100',
  info: 'border-blue-200 bg-accento-chiaro text-slate-900 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-50',
}

export function Riquadro(props: { tono: Tono; titolo?: ReactNode; icona?: LucideIcon; children?: ReactNode }) {
  const Icona = props.icona
  return (
    <div
      role={props.tono === 'errore' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-2xl border p-4 text-sm ${STILI_RIQUADRO[props.tono]}`}
    >
      {Icona && <Icona aria-hidden className="mt-0.5 size-5 shrink-0 opacity-80" />}
      <div className="min-w-0 flex-1">
        {props.titolo && <p className="mb-1.5 text-base font-semibold">{props.titolo}</p>}
        {props.children}
      </div>
    </div>
  )
}

const BASE_BOTTONE =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition select-none ' +
  'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accento disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]'

const STILI_BOTTONE = {
  primario: 'bg-accento text-white shadow-sm hover:bg-blue-700',
  secondario:
    'border border-slate-200 bg-white text-slate-900 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  pericolo:
    'border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300 dark:hover:bg-rose-950',
  piccolo:
    'border border-slate-200 bg-white !px-3 !py-1.5 text-xs text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800',
  tenue: 'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
}

export type VarianteBottone = keyof typeof STILI_BOTTONE

export function Bottone(props: {
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  variante?: VarianteBottone
  larga?: boolean
  icona?: LucideIcon
  children: ReactNode
  'aria-label'?: string
}) {
  const Icona = props.icona
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props['aria-label']}
      className={`${BASE_BOTTONE} ${STILI_BOTTONE[props.variante ?? 'primario']} ${props.larga ? 'w-full' : ''}`}
    >
      {Icona && <Icona aria-hidden className={props.variante === 'piccolo' ? 'size-3.5' : 'size-4'} />}
      {props.children}
    </button>
  )
}

export function LinkBottone(props: {
  to: string
  variante?: VarianteBottone
  icona?: LucideIcon
  larga?: boolean
  children: ReactNode
}) {
  const Icona = props.icona
  return (
    <Link
      to={props.to}
      className={`${BASE_BOTTONE} ${STILI_BOTTONE[props.variante ?? 'secondario']} ${props.larga ? 'w-full' : ''}`}
    >
      {Icona && <Icona aria-hidden className={props.variante === 'piccolo' ? 'size-3.5' : 'size-4'} />}
      {props.children}
    </Link>
  )
}

/** Pulsante tondo con sola icona (il testo è per i lettori di schermo e il suggerimento). */
export function BottoneIcona(props: { icona: LucideIcon; etichetta: string; onClick: () => void; disabled?: boolean }) {
  const Icona = props.icona
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.etichetta}
      title={props.etichetta}
      className="inline-flex size-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-3 focus-visible:outline-accento disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-100"
    >
      <Icona aria-hidden className="size-4.5" />
    </button>
  )
}

export function Scheda(props: {
  titolo?: ReactNode
  icona?: LucideIcon
  sottotitolo?: ReactNode
  azioni?: ReactNode
  /** evidenziata: bordo colorato per ciò che richiede attenzione */
  tono?: 'normale' | 'evidenza' | 'avviso'
  children: ReactNode
}) {
  const Icona = props.icona
  const bordo =
    props.tono === 'evidenza'
      ? 'border-blue-200 ring-1 ring-blue-100 dark:border-blue-900 dark:ring-blue-950'
      : props.tono === 'avviso'
        ? 'border-amber-200 ring-1 ring-amber-100 dark:border-amber-900 dark:ring-amber-950'
        : 'border-slate-200/80 dark:border-slate-800'
  return (
    <section className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 dark:bg-slate-900 ${bordo}`}>
      {(props.titolo || props.azioni) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icona && (
              <span
                aria-hidden
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accento-chiaro text-accento dark:bg-blue-950 dark:text-blue-300"
              >
                <Icona className="size-4.5" />
              </span>
            )}
            <div className="min-w-0">
              {props.titolo && <h2 className="text-base font-semibold sm:text-lg">{props.titolo}</h2>}
              {props.sottotitolo && <p className="text-xs text-slate-500 sm:text-sm">{props.sottotitolo}</p>}
            </div>
          </div>
          {props.azioni}
        </div>
      )}
      {props.children}
    </section>
  )
}

/** Titolo della pagina, con il link per tornare indietro e le azioni a destra. */
export function IntestazionePagina(props: {
  indietro?: { to: string; testo: string }
  titolo: ReactNode
  sottotitolo?: ReactNode
  badge?: ReactNode
  azioni?: ReactNode
}) {
  return (
    <div className="space-y-2">
      {props.indietro && (
        <Link
          to={props.indietro.to}
          className="-ml-1.5 inline-flex max-w-full items-center gap-0.5 rounded-lg py-1 pr-2 pl-0.5 text-sm font-medium text-accento hover:bg-accento-chiaro dark:text-blue-300 dark:hover:bg-blue-950"
        >
          <ChevronLeft aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{props.indietro.testo}</span>
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight break-words sm:text-3xl">{props.titolo}</h1>
            {props.badge}
          </div>
          {props.sottotitolo && <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{props.sottotitolo}</div>}
        </div>
        {props.azioni && <div className="flex basis-full flex-wrap gap-2 sm:basis-auto sm:shrink-0">{props.azioni}</div>}
      </div>
    </div>
  )
}

/** Riga di un elenco che porta a un'altra pagina, con freccia a destra. */
export function RigaLink(props: { to: string; sinistra?: ReactNode; destra?: ReactNode; children: ReactNode }) {
  return (
    <li>
      <Link
        to={props.to}
        className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50 active:bg-slate-100 dark:hover:bg-slate-800/60 dark:active:bg-slate-800"
      >
        {props.sinistra}
        <span className="min-w-0 flex-1 text-sm">{props.children}</span>
        {props.destra}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-slate-400" />
      </Link>
    </li>
  )
}

/** Icona tonda colorata, a sinistra delle righe. */
export function Pallino(props: { icona?: LucideIcon; colore?: keyof typeof STILI_PALLINO; children?: ReactNode }) {
  const Icona = props.icona
  return (
    <span
      aria-hidden
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${STILI_PALLINO[props.colore ?? 'blu']}`}
    >
      {Icona ? <Icona className="size-5" /> : props.children}
    </span>
  )
}

const STILI_PALLINO = {
  blu: 'bg-accento-chiaro text-accento dark:bg-blue-950 dark:text-blue-300',
  ambra: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  verde: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  viola: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  grigio: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  pieno: 'bg-accento text-white',
}

/** Messaggio per un elenco vuoto, con un'azione facoltativa. */
export function Vuoto(props: { icona?: LucideIcon; titolo?: string; children?: ReactNode; azione?: ReactNode }) {
  const Icona = props.icona
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center dark:border-slate-700">
      {Icona && <Icona aria-hidden className="size-7 text-slate-400" />}
      {props.titolo && <p className="font-semibold">{props.titolo}</p>}
      {props.children && <div className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{props.children}</div>}
      {props.azione && <div className="mt-2">{props.azione}</div>}
    </div>
  )
}

/** Sezione che si apre e si chiude toccando il titolo (per le cose che servono di rado). */
export function Soffietto(props: {
  titolo: ReactNode
  icona?: LucideIcon
  aperto?: boolean
  destra?: ReactNode
  children: ReactNode
}) {
  const Icona = props.icona
  return (
    <details
      open={props.aperto}
      className="group rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2.5 rounded-2xl px-4 py-3.5 font-semibold select-none hover:bg-slate-50 sm:px-5 dark:hover:bg-slate-800/50 [&::-webkit-details-marker]:hidden">
        {Icona && <Icona aria-hidden className="size-4.5 shrink-0 text-slate-500" />}
        <h2 className="min-w-0 flex-1 text-base">{props.titolo}</h2>
        {props.destra}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-slate-400 transition group-open:rotate-90" />
      </summary>
      <div className="contenuto-soffietto mx-4 border-t border-slate-100 pt-4 pb-4 sm:mx-5 sm:pb-5 dark:border-slate-800">
        {props.children}
      </div>
    </details>
  )
}

/** Informazione breve con icona (scadenza, giorni, ...). */
export function Info(props: { icona: LucideIcon; children: ReactNode }) {
  const Icona = props.icona
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
      <Icona aria-hidden className="size-3.5 shrink-0 text-slate-500" />
      {props.children}
    </span>
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

export function Avatar(props: { nome: string; foto: string | null; grande?: boolean; piccolo?: boolean }) {
  const dim = props.grande ? 'size-10' : props.piccolo ? 'size-7 text-[10px]' : 'size-8 text-xs'
  if (props.foto) {
    return (
      <img
        src={props.foto}
        alt=""
        referrerPolicy="no-referrer"
        className={`${dim} shrink-0 rounded-full bg-slate-200 object-cover ring-2 ring-white dark:bg-slate-700 dark:ring-slate-900`}
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
      className={`${dim} inline-flex shrink-0 items-center justify-center rounded-full bg-accento-chiaro font-semibold text-accento ring-2 ring-white dark:bg-blue-950 dark:text-blue-200 dark:ring-slate-900`}
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

export const CLASSE_INPUT =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-accento focus:ring-3 focus:ring-accento/20 dark:border-slate-700 dark:bg-slate-950'

export function Campo(props: {
  etichetta: string
  valore: string
  onChange: (v: string) => void
  placeholder?: string
  maxLength?: number
  autoComplete?: string
  aiuto?: string
  autoFocus?: boolean
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-medium">{props.etichetta}</span>
      <input
        value={props.valore}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        autoComplete={props.autoComplete ?? 'off'}
        autoFocus={props.autoFocus}
        className={CLASSE_INPUT}
      />
      {props.aiuto && <span className="mt-1.5 block text-xs text-slate-500">{props.aiuto}</span>}
    </label>
  )
}

/** Etichetta con un controllo qualsiasi dentro (input, select, textarea). */
export function Etichetta(props: { testo: string; aiuto?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-medium">{props.testo}</span>
      {props.children}
      {props.aiuto && <span className="mt-1.5 block text-xs text-slate-500">{props.aiuto}</span>}
    </label>
  )
}

/** Riquadro grigio chiaro per i moduli dentro una scheda. */
export function Modulo(props: { children: ReactNode }) {
  return <div className="space-y-5 rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">{props.children}</div>
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
    <fieldset className="text-sm">
      <legend className="mb-2 font-medium">{props.etichetta}</legend>
      <div className="grid grid-cols-6 gap-1.5 sm:flex sm:flex-wrap">
        {elenco.map((g) => {
          const attivo = props.valore.includes(g)
          return (
            <button
              key={g}
              type="button"
              aria-pressed={attivo}
              aria-label={nomiLunghi[g]}
              onClick={() => props.onChange(attivo ? props.valore.filter((x) => x !== g) : [...props.valore, g].sort())}
              className={`rounded-xl border py-2.5 text-sm font-semibold transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accento sm:min-w-14 sm:px-3 ${
                attivo
                  ? 'border-accento bg-accento text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
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

/** Schede in alto (come le tab di un'app) per dividere una pagina lunga. */
export function Schede<T extends string>(props: {
  schede: { id: T; etichetta: string; icona?: LucideIcon }[]
  attiva: T
  onCambia: (id: T) => void
  etichetta: string
}) {
  return (
    <div
      role="tablist"
      aria-label={props.etichetta}
      className="sticky top-[57px] z-[5] -mx-4 flex gap-1 overflow-x-auto bg-slate-50/90 px-4 py-2 backdrop-blur-md dark:bg-slate-950/90"
    >
      {props.schede.map((s) => {
        const attiva = s.id === props.attiva
        const Icona = s.icona
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={attiva}
            onClick={() => props.onCambia(s.id)}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap transition sm:flex-none ${
              attiva
                ? 'bg-white text-accento shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-blue-300 dark:ring-slate-700'
                : 'text-slate-600 hover:bg-white/70 dark:text-slate-400 dark:hover:bg-slate-900/70'
            }`}
          >
            {Icona && <Icona aria-hidden className="size-4" />}
            {s.etichetta}
          </button>
        )
      })}
    </div>
  )
}
