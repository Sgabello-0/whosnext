/**
 * Il calendario delle interrogazioni: per ogni giorno, quali interrogazioni sono previste e di chi.
 * Logica pura: le date sono le stesse della lista (programma.ts).
 */
import type { DataISO, Momento } from './calendar'
import type { InterrogazioneOsservata } from './daFare'
import { programmaLista } from './programma'

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

/** Tutte le interrogazioni con la lista, giorno per giorno. Ogni giorno: prima le mie, poi per materia. */
export function vociPerGiorno(osservate: readonly InterrogazioneOsservata[], adesso: Momento): Map<DataISO, VoceGiorno[]> {
  const giorni = new Map<DataISO, VoceGiorno[]>()
  for (const d of osservate) {
    if (d.stato !== 'lista' || !d.lista) continue
    const { righe } = programmaLista({
      ordine: d.lista.ordine,
      fissi: d.lista.fissi,
      interrogati: d.lista.interrogati,
      perLezione: d.perLezione,
      giorni: d.giorni,
      subjectId: d.subjectId,
      cal: d.cal,
      adesso,
      creata: d.creata,
    })
    const perData = new Map<DataISO, PersonaGiorno[]>()
    for (const r of righe) {
      const data = r.interrogato ?? (r.stima?.tipo === 'data' ? r.stima.data : null)
      if (!data) continue
      const persona = { uid: r.uid, nome: d.nomi?.[r.uid] ?? 'Ex membro', io: r.uid === d.mioUid, fatto: !!r.interrogato }
      perData.set(data, [...(perData.get(data) ?? []), persona])
    }
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
