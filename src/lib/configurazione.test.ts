import { describe, expect, it } from 'vitest'
import { pulisciGiorni, pulisciInterrogazione, type DatiInterrogazione } from './configurazione'

const valida: DatiInterrogazione = {
  nome: '  Verifica   orale cap. 3 ',
  descrizione: '  Capitoli 3 e 4  ',
  giorni: [3, 1, 1],
  perLezione: 3,
  scadenzaPreferenze: new Date(2026, 10, 10, 20, 0),
}

describe('pulisciGiorni', () => {
  it('ordina, toglie doppioni e la domenica', () => {
    expect(pulisciGiorni([3, 1, 1, 6, 9, 0])).toEqual([0, 1, 3])
  })
})

describe('pulisciInterrogazione', () => {
  it('pulisce nome, descrizione e giorni', () => {
    expect(pulisciInterrogazione(valida)).toMatchObject({
      nome: 'Verifica orale cap. 3',
      descrizione: 'Capitoli 3 e 4',
      giorni: [1, 3],
      perLezione: 3,
    })
  })
  it('accetta il numero per lezione vuoto', () => {
    expect(pulisciInterrogazione({ ...valida, perLezione: null }).perLezione).toBeNull()
  })
  it.each([
    [{ nome: '  ' }, /nome/],
    [{ nome: 'x'.repeat(61) }, /nome/],
    [{ descrizione: 'x'.repeat(501) }, /descrizione/],
    [{ perLezione: 0 }, /per lezione/],
    [{ perLezione: 2.5 }, /per lezione/],
    [{ perLezione: 51 }, /per lezione/],
    [{ scadenzaPreferenze: new Date('boh') }, /scadenza/],
  ] as [Partial<DatiInterrogazione>, RegExp][])('rifiuta %j', (modifica, errore) => {
    expect(() => pulisciInterrogazione({ ...valida, ...modifica })).toThrow(errore)
  })
})
