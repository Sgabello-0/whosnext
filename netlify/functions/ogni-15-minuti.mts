/**
 * Ogni 15 minuti: genera le liste con le preferenze scadute (e avvisa la classe),
 * ricorda di scegliere a chi non l'ha fatto (scadenza entro 6 ore) e, la sera,
 * avvisa chi ha l'interrogazione prevista per domani.
 */
import type { Config } from '@netlify/functions'
import { database } from '../lib/admin'
import { avvisaListaPronta, ricordaDomani, ricordaScelte } from '../lib/eventi'
import { generaScadute } from '../lib/generazione'
import { postinoVero } from '../lib/postinoVero'

/** Ogni passo va avanti anche se uno precedente non riesce (l'errore resta nei log di Netlify). */
async function passo(nome: string, fai: () => Promise<number>): Promise<number> {
  try {
    return await fai()
  } catch (e) {
    console.error(`${nome} non riuscito:`, e)
    return 0
  }
}

export default async function ogni15Minuti() {
  const db = database()
  const postino = postinoVero()
  const adesso = new Date()
  const generate = await generaScadute(db, adesso)
  let avvisi = 0
  for (const r of generate) avvisi += await passo('Avviso "lista pronta"', () => avvisaListaPronta(db, postino, r, adesso))
  avvisi += await passo('Promemoria per scegliere', () => ricordaScelte(db, postino, adesso))
  avvisi += await passo('Avviso "domani"', () => ricordaDomani(db, postino, adesso))
  console.log(`Liste generate: ${generate.length}, notifiche mandate: ${avvisi}`)
}

export const config: Config = { schedule: '*/15 * * * *' }
