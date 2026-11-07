/** Il postino vero: push con Firebase Cloud Messaging; email (per ora spente) con Gmail. */
import nodemailer from 'nodemailer'
import { messaggistica } from './admin'
import { htmlEmail, testoEmail, type Email } from './email'
import type { Postino } from './postino'
import type { Notifica } from './testi'
import { SITO } from './http'


export function postinoVero(): Postino {
  const utente = process.env.EMAIL_UTENTE
  const password = process.env.EMAIL_PASSWORD
  // Email spente per ora: dai domini esterni (Gmail compreso) non arrivano agli indirizzi della scuola.
  // Per riaccenderle (es. con un indirizzo della scuola): EMAIL_ATTIVE=si, EMAIL_UTENTE, EMAIL_PASSWORD su Netlify,
  // e l'interruttore "Email" nelle Impostazioni del sito.
  const posta = process.env.EMAIL_ATTIVE === 'si' && utente && password ? nodemailer.createTransport({ service: 'gmail', auth: { user: utente, pass: password } }) : null

  return {
    async push(tokens: string[], n: Notifica) {
      const risposta = await messaggistica().sendEachForMulticast({
        tokens,
        webpush: {
          headers: { Urgency: 'high', TTL: String(24 * 3600) },
          // solo dati: la notifica la disegna il service worker del sito (src/sw.ts)
          // solo il percorso: il service worker lo apre sul sito da cui è installato
          data: { titolo: n.titolo, testo: n.testo, link: n.percorso },
        },
      })
      return risposta.responses.flatMap((r, i) =>
        !r.success &&
        ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(r.error?.code ?? '')
          ? [tokens[i]!]
          : [],
      )
    },
    async email(a: string, e: Email) {
      if (!posta) return
      await posta.sendMail({
        from: { name: 'WhosNext', address: utente! },
        to: a,
        subject: e.oggetto,
        text: testoEmail(e),
        html: htmlEmail(e),
        headers: { 'List-Unsubscribe': `<${SITO}/impostazioni>` },
      })
    },
  }
}
