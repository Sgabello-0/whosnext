import { NOMI_GIORNI_BREVI } from '../lib/calendar'

/** "mar · gio", oppure "nessun giorno fisso". */
export function GiorniMateria({ giorni }: { giorni: number[] }) {
  return (
    <p className="text-xs text-slate-600 dark:text-slate-400">
      {giorni.length ? giorni.map((g) => NOMI_GIORNI_BREVI[g]).join(' · ') : 'nessun giorno fisso'}
    </p>
  )
}
