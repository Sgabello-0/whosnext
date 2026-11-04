/**
 * Il sito chiama questo indirizzo subito dopo un'azione che merita un avviso:
 * POST /api/notifica { tipo, classId, subjectId, interrogazioneId, id? } con il token di Firebase.
 * Il server controlla nel database che l'azione sia davvero avvenuta, e da chi, prima di avvisare.
 */
import type { Config } from '@netlify/functions'
import { autenticazione, database } from '../lib/admin'
import { avvisaEsitoScambio, avvisaListaPronta, avvisaRichiestaScambio } from '../lib/eventi'
import { postinoVero } from '../lib/postinoVero'

const ORIGINI = (process.env.ORIGINI_PERMESSE ?? 'https://whos-next.web.app,http://localhost:5173').split(',')
const ID = /^[A-Za-z0-9_-]{1,128}$/

function risposta(stato: number, corpo: unknown, origine: string | null): Response {
  const intestazioni: Record<string, string> = { 'Content-Type': 'application/json' }
  if (origine && ORIGINI.includes(origine)) {
    intestazioni['Access-Control-Allow-Origin'] = origine
    intestazioni['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
    intestazioni['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    intestazioni['Vary'] = 'Origin'
  }
  return new Response(stato === 204 ? null : JSON.stringify(corpo), { status: stato, headers: intestazioni })
}

export default async function notifica(req: Request) {
  const origine = req.headers.get('origin')
  if (req.method === 'OPTIONS') return risposta(204, null, origine)
  if (req.method !== 'POST') return risposta(405, { errore: 'solo POST' }, origine)

  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return risposta(401, { errore: 'manca il token' }, origine)
  let uid: string
  try {
    uid = (await autenticazione().verifyIdToken(token)).uid
  } catch {
    return risposta(401, { errore: 'token non valido' }, origine)
  }

  const corpo = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const { tipo, classId, subjectId, interrogazioneId, id } = corpo ?? {}
  if (![classId, subjectId, interrogazioneId].every((x) => typeof x === 'string' && ID.test(x))) {
    return risposta(400, { errore: 'dati non validi' }, origine)
  }
  const r = { classId: classId as string, subjectId: subjectId as string, interrogazioneId: interrogazioneId as string }
  const db = database()
  // solo i membri della classe
  if (!(await db.doc(`classes/${r.classId}/members/${uid}`).get()).exists) return risposta(403, { errore: 'non sei della classe' }, origine)

  const postino = postinoVero()
  let esito: unknown
  if (tipo === 'lista-pronta') esito = await avvisaListaPronta(db, postino, r, new Date())
  else if ((tipo === 'scambio-richiesta' || tipo === 'scambio-esito') && typeof id === 'string' && ID.test(id)) {
    esito =
      tipo === 'scambio-richiesta'
        ? await avvisaRichiestaScambio(db, postino, r, id, uid)
        : await avvisaEsitoScambio(db, postino, r, id, uid)
  } else return risposta(400, { errore: 'tipo sconosciuto' }, origine)
  return risposta(200, { esito }, origine)
}

export const config: Config = { path: '/api/notifica' }
