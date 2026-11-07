/**
 * Il programma di una lista: la data stimata di ognuno e l'ordine in cui mostrarli.
 * Logica pura, la stessa per il sito e per il server.
 *
 * - Chi è in `ordine` riempie i posti delle lezioni, in ordine, `perLezione` per volta.
 * - Chi ha una data fissa (DSA/BES) occupa un posto proprio quel giorno. Se quel giorno non viene
 *   interrogato, dall'ora di uscita passa alla lezione dopo (e così via), e gli altri si adattano.
 * - Il giorno in cui è stata creata l'interrogazione non conta; quello di oggi conta fino all'ora di uscita.
 */
import { aggiungiGiorni, haLezione, prossimeLezioni, primoGiornoUtile, type Calendario, type DataISO, type Momento } from './calendar'
import { stimaInterrogazione, type Stima } from './estimate'

export type DatiProgramma = {
  ordine: readonly string[]
  /** uid → data scelta (DSA/BES) */
  fissi?: Readonly<Record<string, DataISO>>
  interrogati: Readonly<Record<string, string>>
  perLezione: number | null
  giorni: readonly number[]
  subjectId: string | null
  cal: Calendario
  adesso: Momento
  /** giorno di creazione dell'interrogazione (non conta) */
  creata?: DataISO | null
}

export type RigaProgramma = {
  uid: string
  /** posizione nella lista (da 1); null per chi ha la data fissa */
  numero: number | null
  /** data scelta (DSA/BES), se c'è */
  fissa: DataISO | null
  /** giorno in cui è stato interrogato, se lo è */
  interrogato: string | null
  /** stima per chi non è ancora stato interrogato */
  stima: Stima | null
}

export type Programma = {
  /** tutti, nell'ordine in cui mostrarli: chi ha la data fissa è inserito nel suo giorno */
  righe: RigaProgramma[]
  stime: Map<string, Stima>
  /** primo giorno considerato */
  da: DataISO
}

/** Le lezioni della materia da `da` (incluso) fino alla fine dell'anno. */
function* lezioniDa(o: DatiProgramma, da: DataISO): Generator<DataISO> {
  for (let d = da; d <= o.cal.fineAnno; d = aggiungiGiorni(d, 1)) {
    if (haLezione(d, o.giorni, o.subjectId, o.cal)) yield d
  }
}

export function programmaLista(o: DatiProgramma): Programma {
  const fissi = o.fissi ?? {}
  const da = primoGiornoUtile(o.adesso, o.cal, o.creata)
  const stime = new Map<string, Stima>()
  const conGiorni = o.giorni.length > 0
  const perLezione = o.perLezione && o.perLezione >= 1 ? Math.floor(o.perLezione) : null

  // 1. Date fisse: la data scelta, o la prima lezione dopo se è già passata senza interrogazione
  const perData = new Map<DataISO, number>()
  for (const [uid, scelta] of Object.entries(fissi)) {
    if (o.interrogati[uid]) continue
    const dal = scelta > da ? scelta : da
    const [data] = prossimeLezioni({ giorni: o.giorni, subjectId: o.subjectId, cal: o.cal, da: dal, quante: 1 })
    const s: Stima = data ? { tipo: 'data', data } : conGiorni ? { tipo: 'oltre-fine-anno' } : { tipo: 'data', data: dal }
    stime.set(uid, s)
    if (s.tipo === 'data') perData.set(s.data, (perData.get(s.data) ?? 0) + 1)
  }

  // 2. Tutti gli altri, in ordine, nei posti rimasti
  const mancanti = o.ordine.filter((u) => !o.interrogati[u] && !(u in fissi))
  const oggi = o.adesso.oggi
  const giaOggi = Object.values(o.interrogati).filter((d) => d === oggi).length
  if (!perLezione || !conGiorni) {
    // senza numero per lezione o senza giorni non ci sono date da calcolare
    mancanti.forEach((uid, k) =>
      stime.set(uid, stimaInterrogazione({ k, perLezione, giorni: o.giorni, subjectId: o.subjectId, cal: o.cal, da })),
    )
  } else {
    let k = 0
    for (const d of lezioniDa(o, da)) {
      if (k >= mancanti.length) break
      const posti = Math.max(0, perLezione - (perData.get(d) ?? 0) - (d === oggi ? giaOggi : 0))
      for (let n = 0; n < posti && k < mancanti.length; n++) stime.set(mancanti[k++]!, { tipo: 'data', data: d })
    }
    for (; k < mancanti.length; k++) stime.set(mancanti[k]!, { tipo: 'oltre-fine-anno' })
  }

  // 3. Righe: la lista in ordine, con chi ha la data fissa inserito prima del primo che va dopo di lui
  const giornoDi = (uid: string): DataISO | null => {
    const fatto = o.interrogati[uid]
    if (fatto) return fatto
    const s = stime.get(uid)
    return s?.tipo === 'data' ? s.data : null
  }
  const riga = (uid: string, numero: number | null): RigaProgramma => ({
    uid,
    numero,
    fissa: fissi[uid] ?? null,
    interrogato: o.interrogati[uid] ?? null,
    stima: o.interrogati[uid] ? null : (stime.get(uid) ?? null),
  })
  const daInserire = Object.keys(fissi)
    .filter((u) => !o.ordine.includes(u))
    .map((uid) => ({ uid, giorno: giornoDi(uid) ?? '9999-12-31' }))
    .sort((a, b) => a.giorno.localeCompare(b.giorno) || a.uid.localeCompare(b.uid))
  const righe: RigaProgramma[] = []
  o.ordine.forEach((uid, i) => {
    const giorno = giornoDi(uid)
    while (giorno !== null && daInserire.length > 0 && daInserire[0]!.giorno <= giorno) righe.push(riga(daInserire.shift()!.uid, null))
    righe.push(riga(uid, i + 1))
  })
  for (const f of daInserire) righe.push(riga(f.uid, null))
  return { righe, stime, da }
}

/** Le date tra cui uno studente DSA/BES può scegliere: le lezioni in cui si interroga, dal primo giorno utile. */
export function dateDisponibili(o: {
  giorni: readonly number[]
  subjectId: string
  cal: Calendario
  adesso: Momento
  creata?: DataISO | null
  /** scadenza delle preferenze: le date partono dal primo giorno utile dopo la scadenza */
  scadenza?: Momento | null
  perLezione: number | null
  numeroStudenti: number
  /** quante date proporre al massimo (di default quelle che servono per interrogare tutti) */
  quante?: number
}): DataISO[] {
  let da = primoGiornoUtile(o.adesso, o.cal, o.creata)
  const dopoScadenza = o.scadenza ? primoGiornoUtile(o.scadenza, o.cal) : null
  if (dopoScadenza && dopoScadenza > da) da = dopoScadenza
  // le lezioni che servono per interrogare tutti (almeno 5, al massimo 60)
  const servono = o.quante ?? (o.perLezione && o.perLezione >= 1 ? Math.ceil(o.numeroStudenti / o.perLezione) : 20)
  return prossimeLezioni({ giorni: o.giorni, subjectId: o.subjectId, cal: o.cal, da, quante: Math.min(60, Math.max(5, servono)) })
}
