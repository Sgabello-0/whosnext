import { describe, expect, it } from 'vitest'
import { messaggioErroreAuth } from './authErrors'

describe('messaggioErroreAuth', () => {
  it('ignora la richiesta di popup annullata', () => {
    expect(messaggioErroreAuth('auth/cancelled-popup-request')).toBeNull()
  })
  it('segnala il possibile blocco della scuola quando il popup viene chiuso', () => {
    expect(messaggioErroreAuth('auth/popup-closed-by-user')?.possibileBloccoScuola).toBe(true)
  })
  it('spiega come autorizzare il dominio del sito', () => {
    expect(messaggioErroreAuth('auth/unauthorized-domain')?.dettaglio).toContain('Domini autorizzati')
  })
  it('mostra il codice per gli errori sconosciuti', () => {
    expect(messaggioErroreAuth('auth/qualcosa')?.dettaglio).toContain('auth/qualcosa')
  })
})
