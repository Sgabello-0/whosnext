import { describe, expect, it } from 'vitest'
import { ALFABETO_CODICE, codiceDaTesto, formattaCodice, generaCodice, normalizzaCodice } from './codici'

describe('generaCodice', () => {
  it('produce 6 caratteri dell\'alfabeto', () => {
    for (let i = 0; i < 200; i++) {
      const c = generaCodice()
      expect(c).toMatch(/^[A-Z2-9]{6}$/)
      for (const ch of c) expect(ALFABETO_CODICE).toContain(ch)
    }
  })
  it('usa i valori casuali forniti', () => {
    expect(generaCodice(() => new Uint32Array([0, 1, 2, 3, 4, 5]))).toBe('ABCDEF')
    // 31 caratteri: 30 → '9', poi si riparte da capo (31 → 'A', 62 → 'A')
    expect(generaCodice(() => new Uint32Array([30, 31, 62, 0, 0, 0]))).toBe('9AAAAA')
  })
  it('non contiene caratteri confondibili', () => {
    expect(ALFABETO_CODICE).not.toMatch(/[01ILO]/)
  })
})

describe('normalizzaCodice', () => {
  it('accetta minuscole, spazi e trattini', () => {
    expect(normalizzaCodice(' abc-def ')).toBe('ABCDEF')
    expect(normalizzaCodice('ab cd ef')).toBe('ABCDEF')
  })
  it.each(['', 'ABCDE', 'ABCDEFG', 'ABCDE0', 'ABCDEO', 'ABCDE1', 'ABCDEI', 'ABCDEL', 'ABCDE!'])('rifiuta %j', (s) => {
    expect(normalizzaCodice(s)).toBeNull()
  })
})

describe('formattaCodice / codiceDaTesto', () => {
  it('formatta con il trattino', () => {
    expect(formattaCodice('ABCDEF')).toBe('ABC-DEF')
  })
  it('estrae il codice da un link d\'invito', () => {
    expect(codiceDaTesto('https://whosnext.netlify.app/unisciti/ABCDEF')).toBe('ABCDEF')
    expect(codiceDaTesto('http://localhost:5173/unisciti/abc-def?x=1')).toBe('ABCDEF')
  })
  it('accetta anche il codice da solo', () => {
    expect(codiceDaTesto('abc-def')).toBe('ABCDEF')
  })
})
