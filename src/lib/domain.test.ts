import { describe, expect, it } from 'vitest'
import { dominioEmail, emailDelDominio, verificaAccesso } from './domain'

const D = 'studenti.ittsrimini.edu.it'

describe('dominioEmail', () => {
  it('estrae il dominio in minuscolo', () => {
    expect(dominioEmail('Mario.Rossi@Studenti.ITTSRimini.edu.it')).toBe(D)
  })
  it('ignora gli spazi esterni', () => {
    expect(dominioEmail('  mario@studenti.ittsrimini.edu.it ')).toBe(D)
  })
  it.each([null, undefined, '', 'mario', '@studenti.ittsrimini.edu.it', 'mario@', 'a@b@c.it', 'ma rio@x.it'])(
    'restituisce null per %j',
    (email) => {
      expect(dominioEmail(email)).toBeNull()
    },
  )
})

describe('emailDelDominio', () => {
  it('accetta il dominio della scuola', () => {
    expect(emailDelDominio('mario.rossi@studenti.ittsrimini.edu.it', D)).toBe(true)
  })
  it('non distingue maiuscole e minuscole', () => {
    expect(emailDelDominio('MARIO@STUDENTI.ITTSRIMINI.EDU.IT', D)).toBe(true)
  })
  it.each([
    'mario@gmail.com',
    'prof@ittsrimini.edu.it', // dominio dei docenti, non degli studenti
    'mario@studenti.ittsrimini.edu.it.evil.com', // suffisso
    'mario@evilstudenti.ittsrimini.edu.it', // prefisso
    'mario@x.studenti.ittsrimini.edu.it', // sottodominio
    'studenti.ittsrimini.edu.it@gmail.com',
  ])('rifiuta %s', (email) => {
    expect(emailDelDominio(email, D)).toBe(false)
  })
})

describe('verificaAccesso', () => {
  it('ammette uno studente con email verificata', () => {
    expect(verificaAccesso({ email: 'a@' + D, emailVerified: true }, D)).toEqual({ ammesso: true })
  })
  it('rifiuta email non verificate', () => {
    expect(verificaAccesso({ email: 'a@' + D, emailVerified: false }, D)).toEqual({
      ammesso: false,
      motivo: 'email-non-verificata',
    })
  })
  it('rifiuta altri domini', () => {
    expect(verificaAccesso({ email: 'a@gmail.com', emailVerified: true }, D)).toEqual({
      ammesso: false,
      motivo: 'dominio-errato',
    })
  })
  it('rifiuta utenti senza email', () => {
    expect(verificaAccesso({ email: null, emailVerified: true }, D)).toEqual({
      ammesso: false,
      motivo: 'email-mancante',
    })
  })
})
