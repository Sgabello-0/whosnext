import { describe, expect, it } from 'vitest'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { uidDalToken } from './token'

const P = 'progetto-di-prova'

async function chiavi() {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }
  return { insieme: createLocalJWKSet({ keys: [jwk] }), privateKey }
}

async function token(privateKey: CryptoKey, o: { iss?: string; aud?: string; sub?: string; exp?: string } = {}) {
  const t = new SignJWT({ auth_time: Math.floor(Date.now() / 1000) - 10 })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(o.iss ?? `https://securetoken.google.com/${P}`)
    .setAudience(o.aud ?? P)
    .setIssuedAt()
    .setExpirationTime(o.exp ?? '1h')
  if (o.sub !== '') t.setSubject(o.sub ?? 'anna')
  return t.sign(privateKey)
}

describe('token di Firebase', () => {
  it('valido: restituisce l\'uid', async () => {
    const { insieme, privateKey } = await chiavi()
    expect(await uidDalToken(await token(privateKey), { chiavi: insieme, progetto: P })).toBe('anna')
  })
  it('rifiuta altro progetto, scaduto, senza uid, firmato da altri', async () => {
    const { insieme, privateKey } = await chiavi()
    const o = { chiavi: insieme, progetto: P }
    await expect(uidDalToken(await token(privateKey, { aud: 'altro' }), o)).rejects.toThrow()
    await expect(uidDalToken(await token(privateKey, { iss: 'https://securetoken.google.com/altro' }), o)).rejects.toThrow()
    await expect(uidDalToken(await token(privateKey, { exp: '-1m' }), o)).rejects.toThrow()
    await expect(uidDalToken(await token(privateKey, { sub: '' }), o)).rejects.toThrow()
    const estranee = await chiavi()
    await expect(uidDalToken(await token(estranee.privateKey), o)).rejects.toThrow()
    await expect(uidDalToken('non-un-token', o)).rejects.toThrow()
  })
})

describe('id del progetto', () => {
  it('si ricava dall\'email dell\'account di servizio', async () => {
    const { progettoDaEmail } = await import('./admin')
    expect(progettoDaEmail('firebase-adminsdk-abc@mio-progetto-123.iam.gserviceaccount.com')).toBe('mio-progetto-123')
    expect(progettoDaEmail(' x@p.iam.gserviceaccount.com\n')).toBe('p')
    expect(progettoDaEmail('qualcuno@gmail.com')).toBe('')
    expect(progettoDaEmail(undefined)).toBe('')
  })
})
