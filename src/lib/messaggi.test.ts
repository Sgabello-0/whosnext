import { describe, expect, it } from 'vitest'
import {
  linkAssoluto,
  linkWhatsApp,
  messaggioInvito,
  messaggioPromemoria,
  percorsoInterrogazione,
  testoLista,
} from './messaggi'

describe('messaggi', () => {
  it('costruisce i link', () => {
    expect(linkAssoluto('/unisciti/ABCDEF', 'https://whosnext.netlify.app')).toBe('https://whosnext.netlify.app/unisciti/ABCDEF')
    expect(linkAssoluto('classe/x', 'https://a.it/')).toBe('https://a.it/classe/x')
    expect(percorsoInterrogazione('c', 's', 'i')).toBe('/classe/c/materia/s/interrogazione/i')
  })

  it('messaggio d\'invito con link e codice formattato', () => {
    const m = messaggioInvito({ nomeClasse: '4ªB', link: 'https://x.it/unisciti/ABCDEF', codice: 'ABCDEF' })
    expect(m).toContain('*4ªB*')
    expect(m).toContain('https://x.it/unisciti/ABCDEF')
    expect(m).toContain('ABC-DEF')
  })

  it('promemoria con scadenza e risposte mancanti', () => {
    const base = {
      interrogazione: 'Orale cap. 3',
      materia: 'Storia',
      scadenza: new Date(2026, 10, 10, 20, 0),
      link: 'https://x.it/i',
    }
    const m = messaggioPromemoria({ ...base, mancanti: 4 })
    expect(m).toContain('*Storia – Orale cap. 3*')
    expect(m).toContain('mar 10/11 alle 20:00')
    expect(m).toContain('Mancano ancora 4 risposte.')
    expect(messaggioPromemoria({ ...base, mancanti: 1 })).toContain('Manca ancora 1 risposta.')
    expect(messaggioPromemoria({ ...base, mancanti: 0 })).not.toContain('Manca')
  })

  it('lista come testo, con gli interrogati barrati', () => {
    const t = testoLista({
      materia: 'Storia',
      interrogazione: 'Orale',
      link: 'https://x.it/i',
      righe: [
        { nome: 'Bruno Neri', nota: 'interrogato Martedì 03/11', interrogato: true },
        { nome: 'Carla Blu', nota: 'Stimata: Giovedì 05/11', interrogato: false },
      ],
    })
    expect(t.split('\n')).toEqual([
      '*Storia – Orale*',
      '1. ~Bruno Neri~ (interrogato Martedì 03/11)',
      '2. Carla Blu — Stimata: Giovedì 05/11',
      '',
      'Posizioni e date aggiornate: https://x.it/i',
    ])
  })

  it('link di WhatsApp con il testo codificato', () => {
    expect(linkWhatsApp('Ciao a tutti & 3ªB')).toBe('https://wa.me/?text=Ciao%20a%20tutti%20%26%203%C2%AAB')
  })
})
