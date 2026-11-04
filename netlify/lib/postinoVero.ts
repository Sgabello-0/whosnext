/** Il postino vero: push con Firebase Cloud Messaging, email con Gmail (EMAIL_UTENTE + EMAIL_PASSWORD). */
import nodemailer from 'nodemailer'
import { messaggistica } from './admin'
import type { Postino } from './postino'
import type { Notifica } from './testi'

const SITO = process.env.URL_SITO ?? 'https://whos-next.web.app'

export function postinoVero(): Postino {
  const utente = process.env.EMAIL_UTENTE
  const password = process.env.EMAIL_PASSWORD
  const posta = utente && password ? nodemailer.createTransport({ service: 'gmail', auth: { user: utente, pass: password } }) : null

  return {
    async push(tokens: string[], n: Notifica) {
      const risposta = await messaggistica().sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'high', TTL: String(24 * 3600) },
          // solo dati: la notifica la disegna il service worker del sito (src/sw.ts)
          data: { titolo: n.titolo, testo: n.testo, link: `${SITO}${n.percorso}` },
        },
      })
      return risposta.responses.flatMap((r, i) =>
        !r.success &&
        ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code ?? '')
          ? [tokens[i]!]
          : [],
      )
    },
    async email(a: string, oggetto: string, testo: string) {
      if (!posta) return
      await posta.sendMail({ from: `WhosNext <${utente}>`, to: a, subject: oggetto, text: testo })
    },
  }
}
