/**
 * Il sito chiama questo indirizzo subito dopo un'azione che merita un avviso:
 * POST /api/notifica { tipo, classId, subjectId, interrogazioneId, id? } con il token di Firebase.
 * tipo: 'nuova-interrogazione' | 'lista-pronta' | 'segnalazione' | 'scambio-richiesta' (id = richiesta).
 * Il server controlla nel database che l'azione sia davvero avvenuta, e da chi, prima di avvisare.
 */
import type { Config } from '@netlify/functions'
import { database } from '../lib/admin'
import { risposta } from '../lib/http'
import { avvisaListaPronta, avvisaNuovaInterrogazione, avvisaRichiestaScambio, avvisaSegnalazione } from '../lib/eventi'
import { postinoVero } from '../lib/postinoVero'
import { uidDalToken } from '../lib/token'

const ID = /^[A-Za-z0-9_-]{1,128}$/

export default async function notifica(req: Request) {
  const origine = req.headers.get('origin')
  if (req.method === 'OPTIONS') return risposta(204, null, origine)
  if (req.method !== 'POST') return risposta(405, { errore: 'solo POST' }, origine)

  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return risposta(401, { errore: 'manca il token' }, origine)
  let uid: string
  try {
    uid = await uidDalToken(token)
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
  else if (tipo === 'nuova-interrogazione') esito = await avvisaNuovaInterrogazione(db, postino, r, uid, new Date())
  else if (tipo === 'segnalazione') esito = await avvisaSegnalazione(db, postino, r, uid)
  else if (tipo === 'scambio-richiesta' && typeof id === 'string' && ID.test(id)) {
    esito = await avvisaRichiestaScambio(db, postino, r, id, uid)
  } else return risposta(400, { errore: 'tipo sconosciuto' }, origine)
  return risposta(200, { esito }, origine)
}

export const config: Config = { path: '/api/notifica' }
