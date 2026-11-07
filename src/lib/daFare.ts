/**
 * "Le mie interrogazioni" e "Da fare": dai dati di ogni interrogazione osservata
 * decide cosa mostrare allo studente e cosa deve fare chi gestisce la classe. Logica pura.
 */
import { momentoLocale, oggiISO, type Calendario, type DataISO } from './calendar'
import { testoStima, type Stima } from './estimate'
import { programmaLista } from './programma'
import { ultimaLezione } from './lista'
import type { Scelta } from './generateList'
import type { Ruolo, StatoInterrogazione } from './tipi'

/** Tutto quello che serve sapere di un'interrogazione (raccolto dagli "osservatori"). */
export type InterrogazioneOsservata = {
  chiave: string
  classId: string
  nomeClasse: string
  subjectId: string
  nomeMateria: string
  interrogazioneId: string
  nome: string
  stato: StatoInterrogazione
  giorni: number[]
  perLezione: number | null
  /** ms */
  scadenza: number
  cal: Calendario
  mioUid: string
  ruolo: Ruolo
  /** capo o vice */
  staff: boolean
  /** capo, vice o docente con permesso */
  puoModificare: boolean
  /** undefined = non ancora letta (o non serve); null = nessuna preferenza */
  miaScelta?: { scelta: Scelta; dataDSA: string | null } | null
  /** giorno di creazione (non conta per le date) */
  creata?: DataISO | null
  /** esclusi da capo o vice prima della generazione */
  esclusi?: string[]
  /** solo con stato "lista": undefined finché non arriva */
  lista?: {
    ordine: string[]
    fissi?: Record<string, string>
    interrogati: Record<string, string>
    generata: DataISO | null
  } | null
  /** solo per capo e vice con stato "raccolta" */
  risposte?: number
  numeroStudenti?: number
  /** solo per chi può modificare, con stato "lista" */
  segnalazioni?: number
  /** richieste di scambio in arrivo ancora valide (studenti in lista) */
  scambiInArrivo?: number
}

export type VoceMia =
  | { tipo: 'da-scegliere'; scadenza: number }
  | { tipo: 'scelta'; scelta: Scelta; dataDSA: string | null; scadenza: number }
  | { tipo: 'attesa-lista' }
  /** posizione null = data fissa (DSA/BES) */
  | { tipo: 'in-lista'; posizione: number | null; totale: number; stima: Stima; testo: string }
  | { tipo: 'docente-lista'; interrogati: number; totale: number }

export type VoceDaFare =
  | { tipo: 'scambio'; quante: number }
  | { tipo: 'genera' }
  | { tipo: 'segnalazioni'; quante: number }
  | { tipo: 'segna'; data: DataISO }
  | { tipo: 'risposte'; risposte: number; totale: number; scadenza: number }

/** Cosa vede lo studente (o il docente) per questa interrogazione; null se niente. */
export function voceMia(d: InterrogazioneOsservata, adesso: Date): VoceMia | null {
  if (d.stato === 'raccolta') {
    if (d.ruolo === 'docente' || d.miaScelta === undefined || d.esclusi?.includes(d.mioUid)) return null
    if (d.scadenza <= adesso.getTime()) return { tipo: 'attesa-lista' }
    if (d.miaScelta === null) return { tipo: 'da-scegliere', scadenza: d.scadenza }
    return { tipo: 'scelta', scelta: d.miaScelta.scelta, dataDSA: d.miaScelta.dataDSA, scadenza: d.scadenza }
  }
  if (d.stato !== 'lista' || !d.lista) return null
  const { ordine, interrogati } = d.lista
  const fissi = d.lista.fissi ?? {}
  const tutti = [...ordine, ...Object.keys(fissi)]
  if (d.ruolo === 'docente') {
    return { tipo: 'docente-lista', interrogati: tutti.filter((u) => interrogati[u]).length, totale: tutti.length }
  }
  const posizione = ordine.indexOf(d.mioUid)
  if ((posizione < 0 && !(d.mioUid in fissi)) || interrogati[d.mioUid]) return null
  const { stime } = programmaLista({
    ordine,
    fissi,
    interrogati,
    perLezione: d.perLezione,
    giorni: d.giorni,
    subjectId: d.subjectId,
    cal: d.cal,
    adesso: momentoLocale(adesso),
    creata: d.creata,
  })
  const stima = stime.get(d.mioUid) ?? { tipo: 'non-disponibile', prossimaLezione: null }
  return {
    tipo: 'in-lista',
    posizione: posizione >= 0 ? posizione + 1 : null,
    totale: ordine.length,
    stima,
    testo: testoStima(stima),
  }
}

/** Cosa c'è da fare per chi gestisce la classe, in ordine di urgenza. */
export function vociDaFare(d: InterrogazioneOsservata, adesso: Date): VoceDaFare[] {
  const voci: VoceDaFare[] = []
  if (d.stato === 'lista' && d.scambiInArrivo) voci.push({ tipo: 'scambio', quante: d.scambiInArrivo })
  if (d.stato === 'raccolta' && d.staff) {
    if (d.scadenza <= adesso.getTime()) voci.push({ tipo: 'genera' })
    else if (d.risposte !== undefined && d.numeroStudenti !== undefined && d.risposte < d.numeroStudenti) {
      voci.push({ tipo: 'risposte', risposte: d.risposte, totale: d.numeroStudenti, scadenza: d.scadenza })
    }
  }
  if (d.stato === 'lista' && d.puoModificare && d.lista) {
    if (d.segnalazioni) voci.push({ tipo: 'segnalazioni', quante: d.segnalazioni })
    const { ordine, interrogati, generata } = d.lista
    const lezione = ultimaLezione(d.giorni, d.subjectId, d.cal, oggiISO(adesso))
    const qualcunoQuelGiorno = lezione !== null && Object.values(interrogati).includes(lezione)
    if (
      lezione &&
      (!generata || lezione >= generata) &&
      !qualcunoQuelGiorno &&
      [...ordine, ...Object.keys(d.lista.fissi ?? {})].some((u) => !interrogati[u])
    ) {
      voci.push({ tipo: 'segna', data: lezione })
    }
  }
  return voci
}

const PRIORITA: Record<VoceDaFare['tipo'], number> = { scambio: 0, genera: 1, segnalazioni: 2, segna: 3, risposte: 4 }

/** Ordine delle voci "da fare": prima le più urgenti, poi per scadenza. */
export function confrontaDaFare(
  a: { voce: VoceDaFare; d: InterrogazioneOsservata },
  b: { voce: VoceDaFare; d: InterrogazioneOsservata },
): number {
  return PRIORITA[a.voce.tipo] - PRIORITA[b.voce.tipo] || a.d.scadenza - b.d.scadenza || a.d.chiave.localeCompare(b.d.chiave)
}

/** Peso per ordinare "Le mie interrogazioni": prima da scegliere (per scadenza), poi per data stimata. */
export function pesoMia(v: VoceMia, d: InterrogazioneOsservata): [number, number | string] {
  switch (v.tipo) {
    case 'da-scegliere':
      return [0, v.scadenza]
    case 'in-lista':
      if (v.stima.tipo === 'data') return [1, v.stima.data]
      if (v.stima.tipo === 'lezioni') return [2, v.stima.tra]
      return [3, v.posizione ?? 0]
    case 'scelta':
      return [4, v.scadenza]
    case 'attesa-lista':
      return [5, d.scadenza]
    case 'docente-lista':
      return [6, d.nomeMateria]
  }
}

export function confrontaMie(
  a: { voce: VoceMia; d: InterrogazioneOsservata },
  b: { voce: VoceMia; d: InterrogazioneOsservata },
): number {
  const [ga, va] = pesoMia(a.voce, a.d)
  const [gb, vb] = pesoMia(b.voce, b.d)
  if (ga !== gb) return ga - gb
  if (typeof va === 'number' && typeof vb === 'number' && va !== vb) return va - vb
  if (typeof va === 'string' && typeof vb === 'string' && va !== vb) return va.localeCompare(vb)
  return a.d.chiave.localeCompare(b.d.chiave)
}
