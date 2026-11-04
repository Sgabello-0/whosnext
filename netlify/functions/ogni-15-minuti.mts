/**
 * Ogni 15 minuti: genera le liste con le preferenze scadute (e avvisa la classe),
 * ricorda di scegliere a chi non l'ha fatto (scadenza entro 6 ore) e, la sera,
 * avvisa chi probabilmente sarà interrogato domani.
 */
import type { Config } from '@netlify/functions'
import { database } from '../lib/admin'
import { avvisaListaPronta, ricordaDomani, ricordaScelte } from '../lib/eventi'
import { generaScadute } from '../lib/generazione'
import { postinoVero } from '../lib/postinoVero'

export default async function ogni15Minuti() {
  const db = database()
  const postino = postinoVero()
  const adesso = new Date()
  const generate = await generaScadute(db, adesso)
  let avvisi = 0
  for (const r of generate) avvisi += await avvisaListaPronta(db, postino, r, adesso)
  avvisi += await ricordaScelte(db, postino, adesso)
  avvisi += await ricordaDomani(db, postino, adesso)
  console.log(`Liste generate: ${generate.length}, notifiche mandate: ${avvisi}`)
}

export const config: Config = { schedule: '*/15 * * * *' }
