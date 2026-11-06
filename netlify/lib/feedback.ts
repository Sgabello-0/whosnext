/**
 * Feedback dal sito: si salva nel database (feedback/{id}, solo il server lo legge)
 * e si manda per email allo sviluppatore. Al massimo 5 al giorno per persona.
 */
import { FieldValue, type Firestore } from 'firebase-admin/firestore'
import { DOMINI_DEFAULT, tipoAccount } from '../../src/lib/domain'
import { dataItalia } from './ora'

export const MAX_FEEDBACK = 2000
export const FEEDBACK_AL_GIORNO = 5

export type Mittente = { uid: string; email: string | null; nome: string | null }
export type MessaggioFeedback = { oggetto: string; testo: string; rispondiA: string | null }
/** Manda l'email; false se la posta non è configurata. */
export type InviaFeedback = (m: MessaggioFeedback) => Promise<boolean>

export type EsitoFeedback = 'inviato' | 'salvato' | 'troppi' | 'non-valido' | 'non-ammesso'

/** Il testo del feedback com'è arrivato, pulito; null se non va bene. */
export function testoFeedback(corpo: unknown): { testo: string; pagina: string | null } | null {
  if (!corpo || typeof corpo !== 'object') return null
  const { testo, pagina } = corpo as Record<string, unknown>
  if (typeof testo !== 'string') return null
  // via i caratteri di controllo (tranne a capo e tab), spazi in fondo
  const pulito = testo.replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim()
  if (pulito.length < 3 || pulito.length > MAX_FEEDBACK) return null
  const p = typeof pagina === 'string' && /^\/[\w\-/]{0,200}$/.test(pagina) ? pagina : null
  return { testo: pulito, pagina: p }
}

export async function riceviFeedback(
  db: Firestore,
  invia: InviaFeedback,
  chi: Mittente,
  corpo: unknown,
  adesso: Date,
): Promise<EsitoFeedback> {
  // solo gli account della scuola (gli stessi ammessi nel sito)
  if (!tipoAccount(chi.email, DOMINI_DEFAULT)) return 'non-ammesso'
  const f = testoFeedback(corpo)
  if (!f) return 'non-valido'

  const giorno = dataItalia(adesso)
  const limite = db.doc(`feedbackLimiti/${chi.uid}`)
  const rif = db.collection('feedback').doc()
  const ammesso = await db.runTransaction(async (tx) => {
    const l = (await tx.get(limite)).data() as { giorno?: string; conteggio?: number } | undefined
    const conteggio = l?.giorno === giorno ? (l.conteggio ?? 0) : 0
    if (conteggio >= FEEDBACK_AL_GIORNO) return false
    tx.set(limite, { giorno, conteggio: conteggio + 1 })
    tx.set(rif, {
      uid: chi.uid,
      email: chi.email,
      nome: chi.nome,
      testo: f.testo,
      pagina: f.pagina,
      quando: FieldValue.serverTimestamp(),
      inviato: false,
    })
    return true
  })
  if (!ammesso) return 'troppi'

  const nome = chi.nome ?? chi.email ?? 'Utente'
  // se l'email non parte il feedback resta comunque salvato
  const inviato = await invia({
    oggetto: `Feedback su WhosNext da ${nome}`,
    testo: [
      f.testo,
      '',
      '—',
      `Da: ${nome}${chi.email ? ` <${chi.email}>` : ''}`,
      ...(f.pagina ? [`Pagina: ${f.pagina}`] : []),
      `Inviato: ${giorno}`,
      `Id: ${rif.id}`,
    ].join('\n'),
    rispondiA: chi.email,
  }).catch((e: unknown) => {
    console.error('Email del feedback non partita:', e)
    return false
  })
  if (inviato) await rif.update({ inviato: true })
  return inviato ? 'inviato' : 'salvato'
}
