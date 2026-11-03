/**
 * Testi pronti da mandare su WhatsApp (o altrove). Logica pura.
 * Su WhatsApp *testo* diventa grassetto e ~testo~ barrato.
 */
import { formattaCodice } from './codici'
import { formattaScadenza } from './formatoDate'

/** Link completo a una pagina del sito. */
export function linkAssoluto(percorso: string, origine: string = location.origin): string {
  return `${origine.replace(/\/$/, '')}${percorso.startsWith('/') ? '' : '/'}${percorso}`
}

export function percorsoInterrogazione(classId: string, subjectId: string, interrogazioneId: string): string {
  return `/classe/${classId}/materia/${subjectId}/interrogazione/${interrogazioneId}`
}

export function messaggioInvito(o: { nomeClasse: string; link: string; codice: string }): string {
  return [
    `Entra nella classe *${o.nomeClasse}* su Interrogazioni di Classe: lì scegliamo quando essere interrogati e vediamo la lista.`,
    o.link,
    `Oppure inserisci il codice ${formattaCodice(o.codice)}. Serve l'account della scuola.`,
  ].join('\n\n')
}

export function messaggioPromemoria(o: {
  interrogazione: string
  materia: string
  scadenza: Date
  link: string
  mancanti: number
}): string {
  const righe = [
    `*${o.materia} – ${o.interrogazione}*`,
    `Scegli se vuoi essere interrogato all'inizio, a metà o alla fine entro ${formattaScadenza(o.scadenza)}:`,
    o.link,
  ]
  if (o.mancanti > 0) {
    righe.push(o.mancanti === 1 ? 'Manca ancora 1 risposta.' : `Mancano ancora ${o.mancanti} risposte.`)
  }
  righe.push('Chi non sceglie avrà uno dei posti rimasti.')
  return righe.join('\n')
}

export type RigaLista = { nome: string; nota: string; interrogato: boolean }

/** La lista come testo: "1. Carla Blu — Stimata: Martedì 03/11". */
export function testoLista(o: { materia: string; interrogazione: string; righe: RigaLista[]; link: string }): string {
  const elenco = o.righe.map((r, i) => (r.interrogato ? `${i + 1}. ~${r.nome}~ (${r.nota})` : `${i + 1}. ${r.nome} — ${r.nota}`))
  return [`*${o.materia} – ${o.interrogazione}*`, ...elenco, '', `Posizioni e date aggiornate: ${o.link}`].join('\n')
}

/** Link che apre WhatsApp con il testo già scritto (sul telefono l'app, sul computer WhatsApp Web). */
export function linkWhatsApp(testo: string): string {
  return `https://wa.me/?text=${encodeURIComponent(testo)}`
}
