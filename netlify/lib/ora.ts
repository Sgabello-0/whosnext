/** Date e ore in Italia (il server gira in UTC). */
import { aggiungiGiorni, type DataISO, type Momento } from '../../src/lib/calendar'

const FUSO = 'Europe/Rome'

/** "AAAA-MM-GG" del giorno in Italia. */
export function dataItalia(d: Date): DataISO {
  return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export function domaniItalia(d: Date): DataISO {
  return aggiungiGiorni(dataItalia(d), 1)
}

/** Ora (0-23) in Italia. */
export function oraItalia(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO, hour: '2-digit', hourCycle: 'h23' }).format(d))
}

/** "mer 04/11 alle 20:00" in ora italiana. */
export function scadenzaItalia(d: Date): string {
  const parti = Object.fromEntries(
    new Intl.DateTimeFormat('it-IT', {
      timeZone: FUSO,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  return `${parti.weekday} ${parti.day}/${parti.month} alle ${parti.hour}:${parti.minute}`
}

/** "20:00" in ora italiana. */
export function oraMinutiItalia(d: Date): string {
  return new Intl.DateTimeFormat('it-IT', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d)
}

/** Giorno e ora in Italia, per il calendario della scuola. */
export function momentoItalia(d: Date): Momento {
  return { oggi: dataItalia(d), ora: oraMinutiItalia(d) }
}
