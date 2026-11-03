import { describe, expect, it } from 'vitest'
import { dividiMembri, nomeVisualizzato, puoGestireDSA, puoModificareListe } from './membri'
import type { Membro, Ruolo } from './tipi'

function m(nome: string, ruolo: Ruolo, permessoModifica = false): Membro {
  return {
    uid: nome,
    nome,
    email: `${nome}@x.it`,
    foto: null,
    ruolo,
    permessoModifica,
    richiestaPermesso: false,
    codiceUsato: 'ABCDEF',
  }
}

describe('dividiMembri', () => {
  it('mette prima il capo, poi i vice, poi gli studenti in ordine alfabetico', () => {
    const { studenti } = dividiMembri([m('zeno', 'studente'), m('Bea', 'vice'), m('anna', 'studente'), m('Carlo', 'capo')])
    expect(studenti.map((x) => x.nome)).toEqual(['Carlo', 'Bea', 'anna', 'zeno'])
  })
  it('separa i docenti dagli studenti', () => {
    const { studenti, docenti } = dividiMembri([m('Prof. Rossi', 'docente'), m('anna', 'studente'), m('Prof. Bianchi', 'docente')])
    expect(studenti.map((x) => x.nome)).toEqual(['anna'])
    expect(docenti.map((x) => x.nome)).toEqual(['Prof. Bianchi', 'Prof. Rossi'])
  })
  it('ordina ignorando accenti e maiuscole', () => {
    const { studenti } = dividiMembri([m('Élia', 'studente'), m('edoardo', 'studente'), m('Fabio', 'studente')])
    expect(studenti.map((x) => x.nome)).toEqual(['edoardo', 'Élia', 'Fabio'])
  })
})

describe('permessi', () => {
  it('capo, vice e docenti con permesso modificano le liste', () => {
    expect(puoModificareListe(m('a', 'capo'))).toBe(true)
    expect(puoModificareListe(m('a', 'vice'))).toBe(true)
    expect(puoModificareListe(m('a', 'docente', true))).toBe(true)
  })
  it('studenti e docenti senza permesso no', () => {
    expect(puoModificareListe(m('a', 'studente'))).toBe(false)
    expect(puoModificareListe(m('a', 'docente', false))).toBe(false)
    expect(puoModificareListe(null)).toBe(false)
  })
  it('solo capo e vice gestiscono i badge DSA, nemmeno i docenti con permesso', () => {
    expect(puoGestireDSA(m('a', 'capo'))).toBe(true)
    expect(puoGestireDSA(m('a', 'vice'))).toBe(true)
    expect(puoGestireDSA(m('a', 'docente', true))).toBe(false)
    expect(puoGestireDSA(m('a', 'studente'))).toBe(false)
  })
})

describe('nomeVisualizzato', () => {
  it('usa il nome di Google', () => {
    expect(nomeVisualizzato('  Mario Rossi ', 'm@x.it')).toBe('Mario Rossi')
  })
  it('se manca usa la parte prima della @', () => {
    expect(nomeVisualizzato(null, 'mario.rossi@studenti.ittsrimini.edu.it')).toBe('mario.rossi')
    expect(nomeVisualizzato('   ', 'mario@x.it')).toBe('mario')
  })
  it('tronca a 100 caratteri', () => {
    expect(nomeVisualizzato('a'.repeat(150), 'm@x.it')).toHaveLength(100)
  })
})
