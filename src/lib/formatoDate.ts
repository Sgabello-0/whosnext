/** Conversioni per i campi <input type="datetime-local"> (ora locale). */

function due(n: number): string {
  return String(n).padStart(2, '0')
}

/** Date → "AAAA-MM-GGTHH:MM" */
export function aInputDataOra(d: Date): string {
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}T${due(d.getHours())}:${due(d.getMinutes())}`
}

/** "AAAA-MM-GGTHH:MM" → Date (null se vuoto o non valido) */
export function daInputDataOra(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]))
  return Number.isNaN(d.getTime()) ? null : d
}

/** Scadenza proposta: domani alle 20:00. */
export function scadenzaPredefinita(adesso: Date = new Date()): Date {
  const d = new Date(adesso)
  d.setDate(d.getDate() + 1)
  d.setHours(20, 0, 0, 0)
  return d
}

/** "mar 10/11 alle 20:00" */
export function formattaScadenza(d: Date): string {
  const giorni = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
  return `${giorni[d.getDay()]} ${due(d.getDate())}/${due(d.getMonth() + 1)} alle ${due(d.getHours())}:${due(d.getMinutes())}`
}

/** "tra 2 giorni", "tra 5 ore", "tra 10 minuti", "scaduta" */
export function tempoMancante(scadenza: Date, adesso: Date = new Date()): string {
  const ms = scadenza.getTime() - adesso.getTime()
  if (ms <= 0) return 'scaduta'
  const minuti = Math.floor(ms / 60_000)
  if (minuti < 60) return minuti <= 1 ? 'tra meno di un minuto' : `tra ${minuti} minuti`
  const ore = Math.floor(minuti / 60)
  if (ore < 48) return ore === 1 ? "tra 1 ora" : `tra ${ore} ore`
  return `tra ${Math.floor(ore / 24)} giorni`
}
