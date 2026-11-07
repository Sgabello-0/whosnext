/**
 * Le email di WhosNext: un testo semplice (per chi non vede l'HTML) e la versione curata,
 * con logo, pulsante e piè di pagina. Solo HTML con stili in linea, che funziona anche in Gmail e Outlook.
 */
import { CREDITI } from '../../src/lib/crediti'
import { SITO } from './http'

export type Email = {
  oggetto: string
  /** paragrafi del messaggio; **grassetto** con due asterischi */
  righe: string[]
  pulsante: string
  link: string
}

const BLU = '#2f5bd3'

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function grassetto(s: string): string {
  return escape(s).replace(/\*\*(.+?)\*\*/g, '<strong style="color:#0f172a">$1</strong>')
}

export function testoEmail(e: Email): string {
  return [
    ...e.righe.map((r) => r.replace(/\*\*/g, '')),
    `${e.pulsante}: ${e.link}`,
    `— WhosNext\nQuesta email è inviata in automatico: non rispondere, nessuno legge le risposte.\nPuoi disattivare le email dalle Impostazioni: ${SITO}/impostazioni`,
  ].join('\n\n')
}

export function htmlEmail(e: Email): string {
  const paragrafi = e.righe
    .map((r) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#334155">${grassetto(r)}</p>`)
    .join('')
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><title>${escape(e.oggetto)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(e.righe[0]?.replace(/\*\*/g, '') ?? '')}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9">
<tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
    <tr><td style="padding:0 4px 16px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:36px;height:36px;background:${BLU};border-radius:9px;text-align:center;vertical-align:middle">
          <img src="${SITO}/pwa-192.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px">
        </td>
        <td style="padding-left:10px;font-size:19px;font-weight:700;color:#0f172a;letter-spacing:-0.3px">Whos<span style="color:${BLU}">Next</span></td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px 24px">
      <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#0f172a">${escape(e.oggetto)}</h1>
      ${paragrafi}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px"><tr>
        <td style="background:${BLU};border-radius:12px">
          <a href="${escape(e.link)}" style="display:inline-block;padding:13px 22px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none">${escape(e.pulsante)}</a>
        </td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:16px 8px 0;font-size:13px;line-height:1.5;color:#64748b;text-align:center">
      Questa email è inviata in automatico: non rispondere, nessuno legge le risposte.<br>
      Ricevi questa email perché sei iscritto a WhosNext.<br>
      Puoi disattivare le email dalle <a href="${SITO}/impostazioni" style="color:#64748b">Impostazioni</a>.<br>
      <span style="color:#94a3b8">WhosNext · ${CREDITI}</span>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`
}
