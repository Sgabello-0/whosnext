/**
 * Generazione della lista delle interrogazioni (vedi PIANO.md, "Preferenze e generazione della lista").
 * Logica pura: il sorteggio usa un generatore pseudocasuale con seme, così la stessa
 * lista si può ricalcolare e verificare dato il seme salvato nel rapporto.
 *
 * 1. DSA/BES: ricevono la posizione esatta; se due chiedono la stessa vince chi l'ha chiesta prima,
 *    l'altro va alla posizione libera più vicina.
 * 2. I posti rimasti si dividono in tre fasce: inizio, metà, fine.
 * 3. Inizio (mescolati) dai primi posti liberi, Fine dagli ultimi, Metà dal centro della fascia centrale.
 *    Chi non entra nella sua fascia va ai posti liberi più vicini.
 * 4. "Non mi interessa" a caso nei posti rimasti; chi non ha risposto allo stesso modo, ma per ultimo.
 * 5. Rapporto di soddisfazione per il capoclasse.
 */

export type Scelta = 'inizio' | 'meta' | 'fine' | 'indifferente' | 'posizione'
export type Fascia = 'inizio' | 'meta' | 'fine'

export type Preferenza = {
  scelta: Scelta
  /** solo con scelta "posizione" (studenti DSA/BES): da 1 al numero di studenti */
  posizioneDSA: number | null
  /** quando è stata espressa (ms): per i DSA vince chi ha chiesto prima */
  quando: number
}

export type RapportoFascia = { richieste: number; ottenute: number }

export type Rapporto = {
  totale: number
  risposte: number
  senzaRisposta: number
  indifferenti: number
  dsa: { richieste: number; esatte: number }
  inizio: RapportoFascia
  meta: RapportoFascia
  fine: RapportoFascia
  /** seme del sorteggio: con gli stessi dati e lo stesso seme si ottiene la stessa lista */
  seme: number
}

export type Risultato = { ordine: string[]; rapporto: Rapporto }

// ───────────── Numeri casuali con seme ─────────────

/** Generatore mulberry32: veloce, con seme a 32 bit, più che sufficiente per un sorteggio di classe. */
export function generatoreCasuale(seme: number): () => number {
  let a = seme >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function semeCasuale(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!
}

/** Mescola (Fisher–Yates) senza modificare l'originale. */
export function mescola<T>(elementi: readonly T[], casuale: () => number): T[] {
  const a = [...elementi]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(casuale() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

// ───────────── Fasce ─────────────

/**
 * Divide i posti liberi (in ordine) in tre fasce: inizio e fine uguali (un terzo arrotondato),
 * la metà prende il resto. Con 2 posti: uno all'inizio e uno alla fine; con 1 posto: solo la metà.
 */
export function dividiInFasce(liberi: readonly number[]): Record<Fascia, number[]> {
  const t = Math.round(liberi.length / 3)
  return {
    inizio: liberi.slice(0, t),
    meta: liberi.slice(t, liberi.length - t),
    fine: liberi.slice(liberi.length - t),
  }
}

/** Ordine "dal centro verso l'esterno": a parità di distanza prima il posto più in alto. */
export function dalCentro(posti: readonly number[]): number[] {
  const centro = (posti.length - 1) / 2
  return posti
    .map((p, i) => ({ p, d: Math.abs(i - centro), i }))
    .sort((x, y) => x.d - y.d || x.i - y.i)
    .map((x) => x.p)
}

/** In che ordine una fascia preferisce i posti liberi (usato anche per chi è in più). */
function ordinePreferito(fascia: Fascia, posti: readonly number[]): number[] {
  if (fascia === 'inizio') return [...posti].sort((a, b) => a - b)
  if (fascia === 'fine') return [...posti].sort((a, b) => b - a)
  return dalCentro([...posti].sort((a, b) => a - b))
}

/** Posto libero più vicino a `obiettivo`; a parità di distanza quello più in alto nella lista. */
function piuVicinoLibero(obiettivo: number, occupati: (string | null)[]): number {
  for (let d = 0; d < occupati.length; d++) {
    if (obiettivo - d >= 0 && occupati[obiettivo - d] === null) return obiettivo - d
    if (obiettivo + d < occupati.length && occupati[obiettivo + d] === null) return obiettivo + d
  }
  throw new Error('Nessun posto libero')
}

// ───────────── Generazione ─────────────

export function generaLista(opz: {
  /** tutti gli studenti della classe (i docenti non ci sono) */
  studenti: readonly string[]
  /** preferenze per uid; quelle di chi non è più nella classe vengono ignorate */
  preferenze: ReadonlyMap<string, Preferenza>
  /** uid con badge DSA/BES: solo loro possono chiedere una posizione esatta */
  dsa: ReadonlySet<string>
  seme: number
}): Risultato {
  const { studenti, preferenze, dsa, seme } = opz
  const casuale = generatoreCasuale(seme)
  const N = studenti.length
  const posti: (string | null)[] = Array.from({ length: N }, () => null)
  // Ordine stabile di partenza (indipendente dall'ordine in cui arrivano gli studenti)
  const elenco = [...new Set(studenti)].sort()

  const gruppi: Record<Fascia | 'indifferente' | 'senzaRisposta', string[]> = {
    inizio: [],
    meta: [],
    fine: [],
    indifferente: [],
    senzaRisposta: [],
  }
  const richiesteDSA: { uid: string; posizione: number; quando: number }[] = []

  for (const uid of elenco) {
    const p = preferenze.get(uid)
    if (!p) gruppi.senzaRisposta.push(uid)
    else if (p.scelta === 'posizione') {
      if (dsa.has(uid) && p.posizioneDSA !== null && Number.isFinite(p.posizioneDSA)) {
        richiesteDSA.push({ uid, posizione: p.posizioneDSA, quando: p.quando })
      } else gruppi.indifferente.push(uid) // badge tolto nel frattempo
    } else gruppi[p.scelta].push(uid)
  }

  // 1. DSA/BES: prima chi ha chiesto prima
  richiesteDSA.sort((a, b) => a.quando - b.quando || a.uid.localeCompare(b.uid))
  let dsaEsatte = 0
  for (const r of richiesteDSA) {
    const obiettivo = Math.min(Math.max(Math.round(r.posizione), 1), N) - 1
    const posto = piuVicinoLibero(obiettivo, posti)
    posti[posto] = r.uid
    if (posto === obiettivo) dsaEsatte++
  }

  // 2. Fasce sui posti rimasti
  const liberi = () => posti.flatMap((u, i) => (u === null ? [i] : []))
  const fasce = dividiInFasce(liberi())

  // 3. Ognuno nella sua fascia finché c'è posto
  const inPiu: Record<Fascia, string[]> = { inizio: [], meta: [], fine: [] }
  for (const fascia of ['inizio', 'fine', 'meta'] as const) {
    const persone = mescola(gruppi[fascia], casuale)
    const disponibili = ordinePreferito(fascia, fasce[fascia])
    persone.forEach((uid, i) => {
      const posto = disponibili[i]
      if (posto === undefined) inPiu[fascia].push(uid)
      else posti[posto] = uid
    })
  }
  // ... chi è in più va ai posti liberi più vicini alla sua fascia
  for (const fascia of ['inizio', 'fine', 'meta'] as const) {
    for (const uid of inPiu[fascia]) {
      const posto = ordinePreferito(fascia, liberi())[0]!
      posti[posto] = uid
    }
  }

  // 4. "Non mi interessa" a caso, poi chi non ha risposto
  for (const gruppo of [gruppi.indifferente, gruppi.senzaRisposta]) {
    const disponibili = mescola(liberi(), casuale)
    mescola(gruppo, casuale).forEach((uid, i) => {
      posti[disponibili[i]!] = uid
    })
  }

  const ordine = posti as string[]

  // 5. Rapporto
  const insiemi = { inizio: new Set(fasce.inizio), meta: new Set(fasce.meta), fine: new Set(fasce.fine) }
  const posizione = new Map(ordine.map((uid, i) => [uid, i]))
  const rapportoFascia = (f: Fascia): RapportoFascia => ({
    richieste: gruppi[f].length,
    ottenute: gruppi[f].filter((uid) => insiemi[f].has(posizione.get(uid)!)).length,
  })

  return {
    ordine,
    rapporto: {
      totale: N,
      risposte: N - gruppi.senzaRisposta.length,
      senzaRisposta: gruppi.senzaRisposta.length,
      indifferenti: gruppi.indifferente.length,
      dsa: { richieste: richiesteDSA.length, esatte: dsaEsatte },
      inizio: rapportoFascia('inizio'),
      meta: rapportoFascia('meta'),
      fine: rapportoFascia('fine'),
      seme,
    },
  }
}

/** Converte i documenti delle preferenze nel formato dell'algoritmo (va bene sia per il sito sia per il server). */
export function preferenzeDa(
  documenti: { id: string; dati: { scelta: Scelta; posizioneDSA?: number | null; aggiornato?: { toMillis(): number } } }[],
): Map<string, Preferenza> {
  return new Map(
    documenti.map(({ id, dati }) => [
      id,
      { scelta: dati.scelta, posizioneDSA: dati.posizioneDSA ?? null, quando: dati.aggiornato?.toMillis() ?? 0 },
    ]),
  )
}
