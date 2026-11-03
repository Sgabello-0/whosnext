/**
 * Calendario scolastico: giorni di scuola, feste nazionali, vacanze e lezioni extra/annullate.
 * Logica pura, senza Firebase. Le date sono stringhe "AAAA-MM-GG" (fuso orario ininfluente).
 *
 * Giorni della settimana: 0 = lunedì … 5 = sabato, 6 = domenica.
 */

export type DataISO = string

export const NOMI_GIORNI = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'] as const
export const NOMI_GIORNI_BREVI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'] as const
/** Giorni in cui può esserci lezione (la domenica no). */
export const GIORNI_LEZIONE = [0, 1, 2, 3, 4, 5] as const

export type Vacanza = { tipo: 'vacanza'; da: DataISO; a: DataISO; descrizione: string }
export type EccezioneLezione = { tipo: 'lezione-extra' | 'lezione-annullata'; data: DataISO; subjectId: string }
export type Eccezione = Vacanza | EccezioneLezione

export type Calendario = {
  /** 7 valori, da lunedì a domenica: true se c'è scuola */
  giorniScolastici: boolean[]
  eccezioni: Eccezione[]
  /** ultimo giorno di lezione */
  fineAnno: DataISO
}

export const FINE_ANNO_DEFAULT: DataISO = '2027-06-06'

export const CALENDARIO_DEFAULT: Calendario = {
  giorniScolastici: [true, true, true, true, true, false, false],
  eccezioni: [],
  fineAnno: FINE_ANNO_DEFAULT,
}

// ───────────── Date ─────────────

const RE_DATA = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_GIORNO = 86_400_000

export function dataValida(iso: string): boolean {
  const m = RE_DATA.exec(iso)
  if (!m) return false
  const [, a, me, g] = m.map(Number) as [number, number, number, number]
  const d = new Date(Date.UTC(a, me - 1, g))
  return d.getUTCFullYear() === a && d.getUTCMonth() === me - 1 && d.getUTCDate() === g
}

function inMs(iso: DataISO): number {
  const m = RE_DATA.exec(iso)
  if (!m) throw new Error(`Data non valida: ${iso}`)
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function daMs(ms: number): DataISO {
  return new Date(ms).toISOString().slice(0, 10)
}

export function aggiungiGiorni(iso: DataISO, n: number): DataISO {
  return daMs(inMs(iso) + n * MS_GIORNO)
}

/** 0 = lunedì … 6 = domenica */
export function giornoSettimana(iso: DataISO): number {
  return (new Date(inMs(iso)).getUTCDay() + 6) % 7
}

/** Data di oggi secondo l'orologio del dispositivo (ora locale). */
export function oggiISO(adesso: Date = new Date()): DataISO {
  const a = adesso.getFullYear()
  const m = String(adesso.getMonth() + 1).padStart(2, '0')
  const g = String(adesso.getDate()).padStart(2, '0')
  return `${a}-${m}-${g}`
}

/** "Martedì 03/11" */
export function formattaGiorno(iso: DataISO): string {
  return `${NOMI_GIORNI[giornoSettimana(iso)]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

/** "03/11/2026" */
export function formattaData(iso: DataISO): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

// ───────────── Feste nazionali ─────────────

/** Domenica di Pasqua (calendario gregoriano, algoritmo di Meeus/Jones/Butcher). */
export function pasqua(anno: number): DataISO {
  const a = anno % 19
  const b = Math.floor(anno / 100)
  const c = anno % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mese = Math.floor((h + l - 7 * m + 114) / 31)
  const giorno = ((h + l - 7 * m + 114) % 31) + 1
  return `${anno}-${String(mese).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
}

export type Festa = { data: DataISO; nome: string }

/** Feste nazionali italiane di un anno solare. */
export function festeNazionali(anno: number): Festa[] {
  const fisse: [string, string][] = [
    ['01-01', 'Capodanno'],
    ['01-06', 'Epifania'],
    ['04-25', 'Festa della Liberazione'],
    ['05-01', 'Festa del Lavoro'],
    ['06-02', 'Festa della Repubblica'],
    // Festa nazionale di San Francesco d'Assisi, reintrodotta dal 2026 (legge 151/2025)
    ...(anno >= 2026 ? ([['10-04', "San Francesco d'Assisi"]] as [string, string][]) : []),
    ['11-01', 'Ognissanti'],
    ['12-08', 'Immacolata Concezione'],
    ['12-25', 'Natale'],
    ['12-26', 'Santo Stefano'],
  ]
  const p = pasqua(anno)
  return [
    ...fisse.map(([md, nome]) => ({ data: `${anno}-${md}`, nome })),
    { data: p, nome: 'Pasqua' },
    { data: aggiungiGiorni(p, 1), nome: "Lunedì dell'Angelo (Pasquetta)" },
  ].sort((x, y) => x.data.localeCompare(y.data))
}

const cacheFeste = new Map<number, Map<DataISO, string>>()

/** Nome della festa nazionale in quella data, oppure null. */
export function festaNazionale(iso: DataISO): string | null {
  const anno = Number(iso.slice(0, 4))
  let feste = cacheFeste.get(anno)
  if (!feste) {
    feste = new Map(festeNazionali(anno).map((f) => [f.data, f.nome]))
    cacheFeste.set(anno, feste)
  }
  return feste.get(iso) ?? null
}

/** Feste nazionali tra due date (incluse), ad esempio per mostrarle nell'anno scolastico. */
export function festeTra(da: DataISO, a: DataISO): Festa[] {
  const risultato: Festa[] = []
  for (let anno = Number(da.slice(0, 4)); anno <= Number(a.slice(0, 4)); anno++) {
    for (const f of festeNazionali(anno)) if (f.data >= da && f.data <= a) risultato.push(f)
  }
  return risultato
}

// ───────────── Giorni di scuola e lezioni ─────────────

/** La vacanza (d'istituto o regionale) che comprende quella data, se c'è. */
export function vacanzaIn(iso: DataISO, cal: Calendario): Vacanza | null {
  for (const e of cal.eccezioni) if (e.tipo === 'vacanza' && e.da <= iso && iso <= e.a) return e
  return null
}

/** Motivo per cui un giorno non è di scuola, oppure null se lo è. */
export function motivoNoScuola(iso: DataISO, cal: Calendario): string | null {
  const festa = festaNazionale(iso)
  if (festa) return festa
  const vacanza = vacanzaIn(iso, cal)
  if (vacanza) return vacanza.descrizione || 'Vacanza'
  if (!cal.giorniScolastici[giornoSettimana(iso)]) return 'Nessuna lezione in questo giorno della settimana'
  return null
}

export function giornoDiScuola(iso: DataISO, cal: Calendario): boolean {
  return motivoNoScuola(iso, cal) === null
}

/**
 * true se in quella data c'è lezione della materia.
 * Una lezione extra vale sempre (l'ha decisa il capoclasse); una lezione annullata toglie quella del giorno.
 */
export function haLezione(iso: DataISO, giorni: readonly number[], subjectId: string | null, cal: Calendario): boolean {
  if (iso > cal.fineAnno) return false
  if (subjectId !== null) {
    for (const e of cal.eccezioni) {
      if (e.tipo === 'lezione-extra' && e.data === iso && e.subjectId === subjectId) return true
    }
    for (const e of cal.eccezioni) {
      if (e.tipo === 'lezione-annullata' && e.data === iso && e.subjectId === subjectId) return false
    }
  }
  return giorni.includes(giornoSettimana(iso)) && giornoDiScuola(iso, cal)
}

/**
 * Le prossime `quante` lezioni a partire da `da` (incluso), fino alla fine dell'anno.
 * Restituisce meno date se l'anno finisce prima.
 */
export function prossimeLezioni(opz: {
  giorni: readonly number[]
  subjectId: string | null
  cal: Calendario
  da: DataISO
  quante: number
}): DataISO[] {
  const { giorni, subjectId, cal, da, quante } = opz
  const risultato: DataISO[] = []
  const haExtra = subjectId !== null && cal.eccezioni.some((e) => e.tipo === 'lezione-extra' && e.subjectId === subjectId)
  if (quante <= 0 || (giorni.length === 0 && !haExtra)) return risultato
  for (let d = da; d <= cal.fineAnno && risultato.length < quante; d = aggiungiGiorni(d, 1)) {
    if (haLezione(d, giorni, subjectId, cal)) risultato.push(d)
  }
  return risultato
}

/** Normalizza un calendario letto dal database (campi mancanti → valori predefiniti; nessun documento → calendario iniziale). */
export function calendarioDa(dati: Partial<Calendario> | null | undefined): Calendario {
  // Mai salvato: si propone il calendario iniziale con le vacanze regionali
  if (!dati) return calendarioIniziale()
  const giorni = dati?.giorniScolastici
  return {
    giorniScolastici:
      Array.isArray(giorni) && giorni.length === 7 ? giorni.map(Boolean) : [...CALENDARIO_DEFAULT.giorniScolastici],
    eccezioni: Array.isArray(dati?.eccezioni) ? dati.eccezioni : [],
    fineAnno: dati?.fineAnno && dataValida(dati.fineAnno) ? dati.fineAnno : FINE_ANNO_DEFAULT,
  }
}

// ───────────── Validazione (prima di salvare) ─────────────

/** Messaggio d'errore per un'eccezione non valida, oppure null se va bene. */
export function erroreEccezione(e: Eccezione): string | null {
  if (e.tipo === 'vacanza') {
    if (!dataValida(e.da) || !dataValida(e.a)) return 'Date della vacanza non valide.'
    if (e.a < e.da) return "La vacanza finisce prima di iniziare: controlla le date."
    if (e.descrizione.trim().length > 60) return 'Descrizione troppo lunga (massimo 60 caratteri).'
    return null
  }
  if (!dataValida(e.data)) return 'Data non valida.'
  if (!e.subjectId) return 'Scegli la materia.'
  return null
}

/** Messaggio d'errore per un calendario non valido, oppure null se va bene. */
export function erroreCalendario(cal: Calendario): string | null {
  if (cal.giorniScolastici.length !== 7) return 'Giorni della settimana non validi.'
  if (!dataValida(cal.fineAnno)) return "Data di fine anno non valida."
  if (cal.eccezioni.length > 300) return 'Troppe eccezioni nel calendario (massimo 300).'
  for (const e of cal.eccezioni) {
    const errore = erroreEccezione(e)
    if (errore) return errore
  }
  return null
}

function chiaveEccezione(e: Eccezione): string {
  return e.tipo === 'vacanza' ? `v|${e.da}|${e.a}` : `${e.tipo}|${e.data}|${e.subjectId}`
}

function dataEccezione(e: Eccezione): DataISO {
  return e.tipo === 'vacanza' ? e.da : e.data
}

/**
 * Aggiunge un'eccezione al calendario, in ordine di data, senza doppioni.
 * Una lezione extra e una annullata nello stesso giorno per la stessa materia si escludono:
 * resta l'ultima inserita.
 */
export function conEccezione(cal: Calendario, nuova: Eccezione): Calendario {
  const pulita: Eccezione = nuova.tipo === 'vacanza' ? { ...nuova, descrizione: nuova.descrizione.trim() } : nuova
  const opposta =
    pulita.tipo === 'lezione-extra' ? 'lezione-annullata' : pulita.tipo === 'lezione-annullata' ? 'lezione-extra' : null
  const altre = cal.eccezioni.filter(
    (e) =>
      chiaveEccezione(e) !== chiaveEccezione(pulita) &&
      !(opposta && e.tipo === opposta && pulita.tipo !== 'vacanza' && e.data === pulita.data && e.subjectId === pulita.subjectId),
  )
  const eccezioni = [...altre, pulita].sort((x, y) => dataEccezione(x).localeCompare(dataEccezione(y)))
  return { ...cal, eccezioni }
}

/** Toglie un'eccezione (confrontandola per contenuto). */
export function senzaEccezione(cal: Calendario, daTogliere: Eccezione): Calendario {
  const chiave = chiaveEccezione(daTogliere)
  return { ...cal, eccezioni: cal.eccezioni.filter((e) => chiaveEccezione(e) !== chiave) }
}

// ───────────── Vacanze regionali (Emilia-Romagna) ─────────────

/**
 * Vacanze scolastiche dell'Emilia-Romagna per l'anno che inizia a settembre di `annoInizio`.
 * Regola fissa della Regione: Natale dal 24/12 al 06/01, Pasqua dal giovedì prima al martedì dopo.
 * Per il 2026-27 c'è anche il 2 novembre (delibera regionale del 22/05/2026,
 * https://scuola.regione.emilia-romagna.it/novita/notizie/2026/calendario-scolastico-2026-27).
 */
export function vacanzeEmiliaRomagna(annoInizio: number): Vacanza[] {
  const p = pasqua(annoInizio + 1)
  const vacanze: Vacanza[] = [
    { tipo: 'vacanza', da: `${annoInizio}-12-24`, a: `${annoInizio + 1}-01-06`, descrizione: 'Vacanze di Natale' },
    { tipo: 'vacanza', da: aggiungiGiorni(p, -3), a: aggiungiGiorni(p, 2), descrizione: 'Vacanze di Pasqua' },
  ]
  if (annoInizio === 2026) {
    vacanze.unshift({ tipo: 'vacanza', da: '2026-11-02', a: '2026-11-02', descrizione: 'Commemorazione dei defunti' })
  }
  return vacanze
}

/** Calendario proposto per una classe nuova: lun–ven, feste nazionali e vacanze dell'Emilia-Romagna 2026-27. */
export function calendarioIniziale(): Calendario {
  return vacanzeEmiliaRomagna(2026).reduce(conEccezione, { ...CALENDARIO_DEFAULT, eccezioni: [] })
}

/** Le vacanze regionali che mancano nel calendario (per proporre di aggiungerle). */
export function vacanzeRegionaliMancanti(cal: Calendario, annoInizio = 2026): Vacanza[] {
  return vacanzeEmiliaRomagna(annoInizio).filter(
    (v) => !cal.eccezioni.some((e) => e.tipo === 'vacanza' && e.da === v.da && e.a === v.a),
  )
}
