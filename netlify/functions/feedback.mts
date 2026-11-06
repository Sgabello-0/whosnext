/**
 * POST /api/feedback { testo, pagina? } con il token di Firebase: un messaggio per lo sviluppatore.
 * Si salva nel database e arriva per email (da EMAIL_UTENTE a FEEDBACK_A, o allo stesso EMAIL_UTENTE).
 */
import type { Config } from '@netlify/functions'
import nodemailer from 'nodemailer'
import { database } from '../lib/admin'
import { riceviFeedback, type InviaFeedback, type Mittente } from '../lib/feedback'
import { risposta } from '../lib/http'
import { datiDalToken } from '../lib/token'

function postaFeedback(): InviaFeedback {
  const utente = process.env.EMAIL_UTENTE
  const password = process.env.EMAIL_PASSWORD
  const a = process.env.FEEDBACK_A || utente
  if (!utente || !password || !a) return async () => false
  const posta = nodemailer.createTransport({ service: 'gmail', auth: { user: utente, pass: password } })
  return async (m) => {
    await posta.sendMail({
      from: { name: 'WhosNext', address: utente },
      to: a,
      subject: m.oggetto,
      text: m.testo,
      ...(m.rispondiA ? { replyTo: m.rispondiA } : {}),
    })
    return true
  }
}

export default async function feedback(req: Request) {
  const origine = req.headers.get('origin')
  if (req.method === 'OPTIONS') return risposta(204, null, origine)
  if (req.method !== 'POST') return risposta(405, { errore: 'solo POST' }, origine)

  const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
  if (!token) return risposta(401, { errore: 'manca il token' }, origine)
  let chi: Mittente
  try {
    chi = await datiDalToken(token)
  } catch {
    return risposta(401, { errore: 'token non valido' }, origine)
  }

  const corpo = await req.json().catch(() => null)
  let esito
  try {
    esito = await riceviFeedback(database(), postaFeedback(), chi, corpo, new Date())
  } catch (e) {
    console.error('Feedback non salvato:', e)
    return risposta(500, { errore: 'non riuscito' }, origine)
  }
  const stato = { inviato: 200, salvato: 200, troppi: 429, 'non-valido': 400, 'non-ammesso': 403 }[esito]
  return risposta(stato, { esito }, origine)
}

export const config: Config = { path: '/api/feedback' }
