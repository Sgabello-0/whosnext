/**
 * Testi delle notifiche (push ed email). Logica pura.
 * Le notifiche sono solo quattro: nuova interrogazione, lista generata, richiesta di scambio, domani sei interrogato.
 */
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

export function nuovaInterrogazione(o: Interr & { scadenza: string; dsa: boolean; link: string }): Notifica {
  const titolo = `Nuova interrogazione: ${o.materia} – ${o.nome}`
  const testo = o.dsa ? `Scegli il giorno entro ${o.scadenza}.` : `Scegli il posto entro ${o.scadenza}: inizio, metà o fine.`
  return {
    titolo,
    testo,
    percorso: o.percorso,
    email: {
      oggetto: titolo,
      righe: [
        o.dsa
          ? `Puoi scegliere il **giorno** in cui essere interrogato entro **${o.scadenza}**.`
          : `Scegli se preferisci essere interrogato all'inizio, a metà o alla fine entro **${o.scadenza}**.`,
        'Senza una scelta ti verrà assegnato uno dei posti rimasti.',
      ],
      pulsante: 'Scegli',
      link: o.link,
    },
  }
}

/** posizione null = data scelta (DSA/BES) */
export function listaPronta(o: Interr & { posizione: number | null; totale: number; stima: string; link: string }): Notifica {
  const titolo = `Lista generata: ${o.materia} – ${o.nome}`
  const dove = o.posizione === null ? 'Hai la data che hai scelto' : `Sei il n° ${o.posizione} di ${o.totale}`
  const testo = `${dove}. ${o.stima}.`
  return {
    titolo,
    testo,
    percorso: o.percorso,
    email: {
      oggetto: titolo,
      righe: [
        o.posizione === null ? `${dove}. ${o.stima}.` : `Sei il **n° ${o.posizione} di ${o.totale}**. ${o.stima}.`,
        'Le date possono cambiare con vacanze e lezioni saltate: nella pagina della lista sono sempre aggiornate.',
      ],
      pulsante: 'Apri la lista',
      link: o.link,
    },
  }
}

export function richiestaScambio(o: Interr & { chi: string; mia: number; sua: number; link: string }): Notifica {
  const titolo = `${nomeBreve(o.chi)} richiede uno scambio`
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

/** posizione null = data scelta (DSA/BES) */
export function toccaDomani(o: Interr & { giorno: DataISO; posizione: number | null }): Notifica {
  const giorno = formattaGiorno(o.giorno).toLowerCase()
  return {
    titolo: 'Domani sei interrogato',
    testo:
      o.posizione === null
        ? `${o.materia} – ${o.nome} (${giorno}): è la data che hai scelto.`
        : `${o.materia} – ${o.nome} (${giorno}): sei il n° ${o.posizione}.`,
    percorso: o.percorso,
  }
}
