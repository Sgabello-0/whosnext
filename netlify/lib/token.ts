/**
 * Controllo del token di Firebase (chi sta chiamando il server), come fa verifyIdToken di Firebase Admin.
 * Lo facciamo noi con "jose" perché il modulo auth di Firebase Admin carica jose con require(), che sulle funzioni di Netlify non va.
 * Regole: firmato da Google (chiavi pubbliche di securetoken), emesso per il nostro progetto, non scaduto, con un uid.
 */
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { PROGETTO } from './admin'

const CHIAVI_GOOGLE = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
)

type Opzioni = { chiavi?: JWTVerifyGetKey; progetto?: string }

export async function uidDalToken(token: string, o: Opzioni = {}): Promise<string> {
  return (await datiDalToken(token, o)).uid
}

/** uid, email e nome di chi chiama (email e nome come li dà Google, se ci sono). */
export async function datiDalToken(token: string, o: Opzioni = {}): Promise<{ uid: string; email: string | null; nome: string | null }> {
  // con l'emulatore i token non sono firmati: solo se anche il database è quello finto (mai in produzione)
  const emulatore = !o.chiavi && !!process.env.FIREBASE_AUTH_EMULATOR_HOST && !!process.env.FIRESTORE_EMULATOR_HOST
  const progetto = o.progetto ?? (emulatore ? (process.env.GCLOUD_PROJECT ?? 'demo-whosnext') : PROGETTO)
  const dati = emulatore
    ? decodeJwt(token)
    : (
        await jwtVerify(token, o.chiavi ?? CHIAVI_GOOGLE, {
          algorithms: ['RS256'],
          issuer: `https://securetoken.google.com/${progetto}`,
          audience: progetto,
          requiredClaims: ['exp', 'iat', 'sub', 'auth_time'],
        })
      ).payload
  if (emulatore && dati.aud !== progetto) throw new Error('token di un altro progetto')
  const adesso = Date.now() / 1000 + 60 // un minuto di tolleranza sugli orologi
  if ((dati.iat ?? Infinity) > adesso || ((dati.auth_time as number | undefined) ?? Infinity) > adesso) throw new Error('token dal futuro')
  if (typeof dati.sub !== 'string' || dati.sub.length === 0 || dati.sub.length > 128) throw new Error('token senza uid')
  return {
    uid: dati.sub,
    email: typeof dati.email === 'string' ? dati.email : null,
    nome: typeof dati.name === 'string' ? dati.name : null,
  }
}
