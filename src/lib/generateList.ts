/**
 * Generazione della lista delle interrogazioni (vedi PIANO.md, "Preferenze e generazione della lista").
 * Logica pura: il sorteggio usa un generatore pseudocasuale con seme, così la stessa
 * lista si può ricalcolare e verificare dato il seme salvato nel rapporto.
 *
 * 1. DSA/BES: chi ha scelto una data non entra nell'ordine: ha la sua data fissa (vedi programma.ts).
 * 2. I posti si dividono in tre fasce: inizio, metà, fine.
 * 3. Inizio (mescolati) dai primi posti liberi, Fine dagli ultimi, Metà dal centro della fascia centrale.
 *    Chi non entra nella sua fascia va ai posti liberi più vicini.
 * 4. "Non mi interessa" a caso nei posti rimasti; chi non ha risposto allo stesso modo, ma per ultimo.
 * 5. Rapporto di soddisfazione per il capoclasse.
 */

export type Scelta = 'inizio' | 'meta' | 'fine' | 'indifferente' | 'data'
export type Fascia = 'inizio' | 'meta' | 'fine'
const SCELTE: readonly unknown[] = ['inizio', 'meta', 'fine', 'indifferente', 'data']
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/

export type Preferenza = {
  scelta: Scelta
  /** solo con scelta "data" (studenti DSA/BES): il giorno scelto, AAAA-MM-GG */
  dataDSA: string | null
  /** quando è stata espressa (ms) */
  quando: number
}

export type RapportoFascia = { richieste: number; ottenute: number }

export type Rapporto = {
  totale: number
  risposte: number
  senzaRisposta: number
  indifferenti: number
  /** DSA/BES con la data scelta (esatte = richieste: la data è sempre rispettata) */
  dsa: { richieste: number; esatte: number }
  inizio: RapportoFascia
  meta: RapportoFascia
  fine: RapportoFascia
  /** seme del sorteggio: con gli stessi dati e lo stesso seme si ottiene la stessa lista */
  seme: number
}

export type Risultato = {
  ordine: string[]
  /** uid → data scelta (DSA/BES): fuori dall'ordine */
  fissi: Record<string, string>
  rapporto: Rapporto
}

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

// ───────────── Generazione ─────────────

export function generaLista(opz: {
  /** tutti gli studenti della classe (i docenti non ci sono) */
  studenti: readonly string[]
  /** preferenze per uid; quelle di chi non è più nella classe vengono ignorate */
  preferenze: ReadonlyMap<string, Preferenza>
  /** uid con badge DSA/BES: solo loro possono scegliere la data */
  dsa: ReadonlySet<string>
  seme: number
}): Risultato {
  const { studenti, preferenze, dsa, seme } = opz
  const casuale = generatoreCasuale(seme)
  // Ordine stabile di partenza (indipendente dall'ordine in cui arrivano gli studenti)
  const tutti = [...new Set(studenti)].sort()
  const fissi: Record<string, string> = {}
  for (const uid of tutti) {
    const p = preferenze.get(uid)
    if (p?.scelta === 'data' && dsa.has(uid) && p.dataDSA !== null && RE_DATA.test(p.dataDSA)) fissi[uid] = p.dataDSA
  }
  const elenco = tutti.filter((u) => !(u in fissi))
  const N = elenco.length
  const posti: (string | null)[] = Array.from({ length: N }, () => null)

  const gruppi: Record<Fascia | 'indifferente' | 'senzaRisposta', string[]> = {
    inizio: [],
    meta: [],
    fine: [],
    indifferente: [],
    senzaRisposta: [],
  }
  for (const uid of elenco) {
    const p = preferenze.get(uid)
    if (!p) gruppi.senzaRisposta.push(uid)
    // "data" senza badge (tolto nel frattempo) vale come "non mi interessa"
    else if (p.scelta === 'data') gruppi.indifferente.push(uid)
    else (gruppi[p.scelta] ?? gruppi.indifferente).push(uid)
  }

  // 2. Fasce
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

  const quantiFissi = Object.keys(fissi).length
  return {
    ordine,
    fissi,
    rapporto: {
      totale: N + quantiFissi,
      risposte: N + quantiFissi - gruppi.senzaRisposta.length,
      senzaRisposta: gruppi.senzaRisposta.length,
      indifferenti: gruppi.indifferente.length,
      dsa: { richieste: quantiFissi, esatte: quantiFissi },
      inizio: rapportoFascia('inizio'),
      meta: rapportoFascia('meta'),
      fine: rapportoFascia('fine'),
      seme,
    },
  }
}

/** Converte i documenti delle preferenze nel formato dell'algoritmo (va bene sia per il sito sia per il server). */
export function preferenzeDa(
  documenti: { id: string; dati: { scelta: Scelta; dataDSA?: string | null; aggiornato?: { toMillis(): number } } }[],
): Map<string, Preferenza> {
  return new Map(
    documenti.map(({ id, dati }) => [
      id,
      {
        // dati vecchi o scritti a mano: un valore sconosciuto vale come "non mi interessa"
        scelta: SCELTE.includes(dati.scelta) ? dati.scelta : 'indifferente',
        dataDSA: typeof dati.dataDSA === 'string' && RE_DATA.test(dati.dataDSA) ? dati.dataDSA : null,
        quando: typeof dati.aggiornato?.toMillis === 'function' ? dati.aggiornato.toMillis() : 0,
      },
    ]),
  )
}
