import { formattaGiorno, oggiISO, prossimeLezioni, type Calendario } from '../lib/calendar'

/** Le prossime lezioni (da oggi), secondo il calendario della classe. */
export function ProssimeLezioni(props: { giorni: number[]; subjectId: string; cal: Calendario; quante?: number }) {
  const lezioni = prossimeLezioni({
    giorni: props.giorni,
    subjectId: props.subjectId,
    cal: props.cal,
    da: oggiISO(),
    quante: props.quante ?? 5,
  })
  if (lezioni.length === 0) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {props.giorni.length === 0 ? 'Nessun giorno di lezione fisso.' : "Nessuna lezione fino alla fine dell'anno."}
      </p>
    )
  }
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Prossime lezioni">
      {lezioni.map((d) => (
        <li key={d} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium dark:bg-slate-800">
          {formattaGiorno(d)}
        </li>
      ))}
    </ul>
  )
}
