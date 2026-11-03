import { describe, expect, it, vi } from 'vitest'
import { FirebaseError } from 'firebase/app'
import { ErroreApp } from './classi'
import { messaggioErrore } from './errori'

describe('messaggioErrore', () => {
  it('usa il messaggio degli errori dell\'app', () => {
    expect(messaggioErrore(new ErroreApp('codice-inesistente', 'Codice inesistente.'))).toBe('Codice inesistente.')
  })
  it('traduce i permessi negati', () => {
    expect(messaggioErrore(new FirebaseError('permission-denied', 'x'))).toContain('permesso')
  })
  it('mostra il codice degli errori Firebase sconosciuti', () => {
    expect(messaggioErrore(new FirebaseError('aborted', 'x'))).toContain('aborted')
  })
  it('gestisce errori qualsiasi', () => {
    const spia = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(messaggioErrore(new Error('boh'))).toBe('Errore imprevisto.')
    spia.mockRestore()
  })
})
