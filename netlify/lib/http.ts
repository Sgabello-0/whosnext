/** Risposte JSON con CORS solo per il sito (e lo sviluppo in locale). */
const ORIGINI = (process.env.ORIGINI_PERMESSE ?? 'https://whos-next.web.app,http://localhost:5173').split(',')

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
