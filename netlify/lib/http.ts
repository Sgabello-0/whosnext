/**
 * Indirizzo del sito, solo dalle variabili di Netlify (nel codice pubblico non c'è):
 * URL_SITO (es. https://il-tuo-sito.web.app) e ORIGINI_PERMESSE (gli indirizzi che possono chiamare il server,
 * separati da virgole; di default URL_SITO). In locale va sempre bene http://localhost:5173.
 */
export const SITO = (process.env.URL_SITO ?? '').replace(/\/+$/, '')
const ORIGINI = [...(process.env.ORIGINI_PERMESSE ?? SITO).split(','), 'http://localhost:5173'].map((o) => o.trim()).filter(Boolean)

/** Risposte JSON con CORS solo per il sito (e lo sviluppo in locale). */

export function risposta(stato: number, corpo: unknown, origine: string | null): Response {
  const intestazioni: Record<string, string> = { 'Content-Type': 'application/json' }
  if (origine && ORIGINI.includes(origine)) {
    intestazioni['Access-Control-Allow-Origin'] = origine
    intestazioni['Access-Control-Allow-Headers'] = 'Authorization, Content-Type'
    intestazioni['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    intestazioni['Vary'] = 'Origin'
  }
  return new Response(stato === 204 ? null : JSON.stringify(corpo), { status: stato, headers: intestazioni })
}
