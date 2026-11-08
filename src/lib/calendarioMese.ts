/**
 * Il calendario delle interrogazioni: per ogni giorno, quali interrogazioni sono previste e di chi.
 * Logica pura: le date sono le stesse della lista (programma.ts).
 */
import { momentoLocale, type DataISO, type Momento } from './calendar'
import type { InterrogazioneOsservata } from './daFare'
import { dateDisponibili, programmaLista } from './programma'

export type PersonaGiorno = { uid: string; nome: string; io: boolean; fatto: boolean }

export type VoceGiorno = {
  chiave: string
  classId: string
  subjectId: string
  interrogazioneId: string
  materia: string
  interrogazione: string
  classe: string
  persone: PersonaGiorno[]
  /** in questa voce c'è anche chi guarda */
  mia: boolean
  /** quando non si sa ancora chi tocca: lista non generata, o numero per lezione non indicato */
  nota: 'lista-da-generare' | 'non-stimabile' | null
}

/** Nome breve: il primo nome, con l'iniziale del cognome se due persone della stessa lista si chiamano uguale. */
export function nomiBrevi(nomi: readonly string[]): string[] {
  const primo = (n: string) => n.trim().split(/\s+/)[0] ?? n
  const conteggio = new Map<string, number>()
  for (const n of nomi) conteggio.set(primo(n), (conteggio.get(primo(n)) ?? 0) + 1)
  return nomi.map((n) => {
    const p = primo(n)
    if ((conteggio.get(p) ?? 0) < 2) return p
    const parti = n.trim().split(/\s+/)
    return parti.length > 1 ? `${p} ${parti[parti.length - 1]![0]}.` : p
  })
}

/** Quante lezioni mostrare quando non si sa chi tocca. */
const LEZIONI_SENZA_NOMI = 15

/**
 * Tutte le interrogazioni in corso, giorno per giorno. Ogni giorno: prima le mie, poi per materia.
 * Con la lista: chi tocca in quel giorno. Senza lista o senza numero per lezione: le lezioni possibili, senza nomi.
 */
export function vociPerGiorno(osservate: readonly InterrogazioneOsservata[], adesso: Momento): Map<DataISO, VoceGiorno[]> {
  const giorni = new Map<DataISO, VoceGiorno[]>()

  for (const d of osservate) {
    const perData = new Map<DataISO, PersonaGiorno[]>()
    let nota: VoceGiorno['nota'] = null
    const base = { giorni: d.giorni, subjectId: d.subjectId, cal: d.cal, adesso, creata: d.creata, perLezione: d.perLezione }
    const lezioni = (quante: number) =>
      dateDisponibili({ ...base, numeroStudenti: 1, quante, scadenza: d.stato === 'raccolta' ? momentoLocale(new Date(d.scadenza)) : null })

    if (d.stato === 'raccolta') {
      nota = 'lista-da-generare'
      for (const data of lezioni(LEZIONI_SENZA_NOMI)) perData.set(data, [])
      // il giorno scelto da chi ha il badge DSA/BES è già suo
      if (d.miaScelta?.scelta === 'data' && d.miaScelta.dataDSA) {
        perData.set(d.miaScelta.dataDSA, [{ uid: d.mioUid, nome: d.nomi?.[d.mioUid] ?? 'Tu', io: true, fatto: false }])
      }
    } else if (d.stato === 'lista' && d.lista) {
      const { righe } = programmaLista({ ...base, ordine: d.lista.ordine, fissi: d.lista.fissi, interrogati: d.lista.interrogati })
      for (const r of righe) {
        const data = r.interrogato ?? (r.stima?.tipo === 'data' ? r.stima.data : null)
        if (!data) continue
        const persona = { uid: r.uid, nome: d.nomi?.[r.uid] ?? 'Ex membro', io: r.uid === d.mioUid, fatto: !!r.interrogato }
        perData.set(data, [...(perData.get(data) ?? []), persona])
      }
      // senza numero per lezione non si sa chi tocca: restano le lezioni possibili
      if (righe.some((r) => !r.interrogato && (r.stima?.tipo === 'non-disponibile' || r.stima?.tipo === 'lezioni'))) {
        nota = 'non-stimabile'
        for (const data of lezioni(LEZIONI_SENZA_NOMI)) if (!perData.has(data)) perData.set(data, [])
      }
    } else continue

    for (const [data, persone] of perData) {
      const voce: VoceGiorno = {
        chiave: d.chiave,
        classId: d.classId,
        subjectId: d.subjectId,
        interrogazioneId: d.interrogazioneId,
        materia: d.nomeMateria,
        interrogazione: d.nome,
        classe: d.nomeClasse,
        persone,
        mia: persone.some((p) => p.io),
        nota: persone.length === 0 ? nota : null,
      }
      giorni.set(data, [...(giorni.get(data) ?? []), voce])
    }
  }
  for (const voci of giorni.values()) {
    voci.sort((a, b) => Number(b.mia) - Number(a.mia) || a.materia.localeCompare(b.materia, 'it') || a.chiave.localeCompare(b.chiave))
  }
  return giorni
}

const z = (n: number) => String(n).padStart(2, '0')

/** Le caselle di un mese (mese da 0), da lunedì: null per i giorni prima del primo del mese. */
export function caselleMese(anno: number, mese: number): (DataISO | null)[] {
  const primo = (new Date(Date.UTC(anno, mese, 1)).getUTCDay() + 6) % 7
  const quanti = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate()
  return [
    ...Array.from({ length: primo }, () => null),
    ...Array.from({ length: quanti }, (_, i) => `${anno}-${z(mese + 1)}-${z(i + 1)}`),
  ]
}

/** Il mese prima o dopo. */
export function spostaMese(m: { anno: number; mese: number }, di: number): { anno: number; mese: number } {
  const t = m.anno * 12 + m.mese + di
  return { anno: Math.floor(t / 12), mese: ((t % 12) + 12) % 12 }
}
