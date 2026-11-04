/** Testi delle notifiche (push ed email). Logica pura. */
import { formattaGiorno, type DataISO } from '../../src/lib/calendar'
import type { Email } from './email'

export type Notifica = {
  titolo: string
  testo: string
  /** percorso nel sito da aprire toccando la notifica */
  percorso: string
  /** solo per le notifiche più importanti */
  email?: Email
}

type Interr = { materia: string; nome: string; percorso: string }

function nomeBreve(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome
}

export function listaPronta(o: Interr & { posizione: number; totale: number; stima: string; link: string }): Notifica {
  const titolo = `${o.materia} – ${o.nome}: lista pubblicata`
  const testo = `Sei il n° ${o.posizione} di ${o.totale}. ${o.stima}.`
  return {
    titolo,
    testo,
    percorso: o.percorso,
    email: {
      oggetto: titolo,
      righe: [
        `Sei il **n° ${o.posizione} di ${o.totale}**. ${o.stima}.`,
        'Le date possono cambiare con vacanze e lezioni saltate: nella pagina della lista sono sempre aggiornate.',
      ],
      pulsante: 'Apri la lista',
      link: o.link,
    },
  }
}

export function richiestaScambio(o: Interr & { chi: string; mia: number; sua: number; link: string }): Notifica {
  const titolo = `Richiesta di scambio da ${nomeBreve(o.chi)}`
  const testo = `${o.materia} – ${o.nome}: passeresti dal n° ${o.mia} al n° ${o.sua}. Apri per accettare o rifiutare.`
  return {
    titolo,
    testo,
    percorso: o.percorso,
    email: {
      oggetto: `${o.chi} ti chiede uno scambio di posto (${o.materia})`,
      righe: [
        `**${o.chi}** vorrebbe scambiare il posto con te in ${o.materia} – ${o.nome}.`,
        `Tu passeresti dal **n° ${o.mia}** al **n° ${o.sua}**. Se non ti va, puoi rifiutare.`,
      ],
      pulsante: 'Rispondi',
      link: o.link,
    },
  }
}

export function esitoScambio(o: Interr & { chi: string; accettato: boolean; posizione: number }): Notifica {
  return o.accettato
    ? {
        titolo: `Scambio accettato da ${nomeBreve(o.chi)}`,
        testo: `${o.materia} – ${o.nome}: ora sei il n° ${o.posizione}.`,
        percorso: o.percorso,
      }
    : {
        titolo: `Scambio rifiutato da ${nomeBreve(o.chi)}`,
        testo: `${o.materia} – ${o.nome}: la tua posizione resta il n° ${o.posizione}.`,
        percorso: o.percorso,
      }
}

export function ricordaScelta(o: Interr & { ora: string }): Notifica {
  return {
    titolo: `Preferenza da indicare entro le ${o.ora}`,
    testo: `${o.materia} – ${o.nome}: indica se preferisci inizio, metà o fine. Senza una scelta ti verrà assegnato uno dei posti rimasti.`,
    percorso: o.percorso,
  }
}

export function toccaDomani(o: Interr & { giorno: DataISO; posizione: number }): Notifica {
  return {
    titolo: 'Interrogazione prevista per domani',
    testo: `${o.materia} – ${o.nome} (${formattaGiorno(o.giorno).toLowerCase()}): sei il n° ${o.posizione}.`,
    percorso: o.percorso,
  }
}
