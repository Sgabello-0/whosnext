import { describe, expect, it } from 'vitest'
import { DOMINI_DEFAULT, dominioEmail, emailDelDominio, tipoAccount, verificaAccesso } from './domain'

const S = 'studenti.ittsrimini.edu.it'
const P = 'ittsrimini.edu.it'
const DOMINI = { studenti: S, docenti: P }

describe('dominioEmail', () => {
  it('estrae il dominio in minuscolo', () => {
    expect(dominioEmail('Mario.Rossi@Studenti.ITTSRimini.edu.it')).toBe(S)
  })
  it('ignora gli spazi esterni', () => {
    expect(dominioEmail('  mario@studenti.ittsrimini.edu.it ')).toBe(S)
  })
  it.each([null, undefined, '', 'mario', '@studenti.ittsrimini.edu.it', 'mario@', 'a@b@c.it', 'ma rio@x.it'])(
    'restituisce null per %j',
    (email) => {
      expect(dominioEmail(email)).toBeNull()
    },
  )
})

describe('emailDelDominio', () => {
  it('accetta il dominio indicato', () => {
    expect(emailDelDominio('mario.rossi@studenti.ittsrimini.edu.it', S)).toBe(true)
  })
  it('non distingue maiuscole e minuscole', () => {
    expect(emailDelDominio('MARIO@STUDENTI.ITTSRIMINI.EDU.IT', S)).toBe(true)
  })
  it.each([
    'mario@gmail.com',
    'prof@ittsrimini.edu.it', // dominio dei docenti, non degli studenti
    'mario@studenti.ittsrimini.edu.it.evil.com', // suffisso
    'mario@evilstudenti.ittsrimini.edu.it', // prefisso
    'mario@x.studenti.ittsrimini.edu.it', // sottodominio
    'studenti.ittsrimini.edu.it@gmail.com',
  ])('rifiuta %s per il dominio studenti', (email) => {
    expect(emailDelDominio(email, S)).toBe(false)
  })
})

describe('tipoAccount', () => {
  it('i domini predefiniti sono quelli della scuola', () => {
    expect(DOMINI_DEFAULT).toEqual(DOMINI)
  })
  it('riconosce uno studente', () => {
    expect(tipoAccount('mario.rossi@studenti.ittsrimini.edu.it', DOMINI)).toBe('studente')
  })
  it('riconosce un docente', () => {
    expect(tipoAccount('anna.bianchi@ittsrimini.edu.it', DOMINI)).toBe('docente')
  })
  it('uno studente non viene mai scambiato per docente (il dominio studenti finisce come quello docenti)', () => {
    expect(tipoAccount('Mario@Studenti.Ittsrimini.Edu.It', DOMINI)).toBe('studente')
  })
  it.each([
    'mario@gmail.com',
    'prof@altro.ittsrimini.edu.it', // altri sottodomini della scuola
    'prof@ittsrimini.edu.it.evil.com',
    'prof@fakeittsrimini.edu.it',
    'prof@edu.it',
  ])('rifiuta %s', (email) => {
    expect(tipoAccount(email, DOMINI)).toBeNull()
  })
})

describe('verificaAccesso', () => {
  it('ammette uno studente con email verificata', () => {
    expect(verificaAccesso({ email: 'a@' + S, emailVerified: true }, DOMINI)).toEqual({
      ammesso: true,
      tipo: 'studente',
    })
  })
  it('ammette un docente con email verificata', () => {
    expect(verificaAccesso({ email: 'prof@' + P, emailVerified: true }, DOMINI)).toEqual({
      ammesso: true,
      tipo: 'docente',
    })
  })
  it('rifiuta email non verificate, anche dei docenti', () => {
    expect(verificaAccesso({ email: 'prof@' + P, emailVerified: false }, DOMINI)).toEqual({
      ammesso: false,
      motivo: 'email-non-verificata',
    })
  })
  it('rifiuta altri domini', () => {
    expect(verificaAccesso({ email: 'a@gmail.com', emailVerified: true }, DOMINI)).toEqual({
      ammesso: false,
      motivo: 'dominio-errato',
    })
  })
  it('rifiuta utenti senza email', () => {
    expect(verificaAccesso({ email: null, emailVerified: true }, DOMINI)).toEqual({
      ammesso: false,
      motivo: 'email-mancante',
    })
  })
})
