import { useState } from 'react'
import { db } from '../../lib/firebase'
import { rifPreferenze } from '../../lib/configurazione'
import { messaggioErrore } from '../../lib/errori'
import type { Scelta } from '../../lib/generateList'
import { useQuery } from '../../lib/hooks'
import { generaEPubblicaLista } from '../../lib/preferenze'
import { ETICHETTA_SCELTA } from '../../lib/testiPreferenze'
import type { DocPreferenza, Membro } from '../../lib/tipi'
import { Bottone, Caricamento, Riquadro, Scheda } from '../ui'
import { Condividi } from '../Condividi'
import { linkAssoluto, messaggioPromemoria, percorsoInterrogazione } from '../../lib/messaggi'
import { useAvvisi } from '../Avvisi'
import { useConferma } from '../Conferma'

const ORDINE_SCELTE: Scelta[] = ['inizio', 'meta', 'fine', 'indifferente', 'posizione']

/** Per capoclasse e vice: chi ha risposto, cosa ha scelto, e il pulsante per generare la lista. */
export function PannelloPreferenze(p: {
  classId: string
  subjectId: string
  interrogazioneId: string
  mioUid: string
  studenti: Membro[]
  scaduta: boolean
  nomeInterrogazione: string
  nomeMateria: string
  scadenza: Date
}) {
  const preferenze = useQuery<DocPreferenza>(
    db && rifPreferenze(db, p.classId, p.subjectId, p.interrogazioneId),
    `preferenze/${p.classId}/${p.subjectId}/${p.interrogazioneId}`,
  )
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()
  const conferma = useConferma()

  if (preferenze.errore) return <Riquadro tono="errore">{messaggioErrore(preferenze.errore)}</Riquadro>
  if (!preferenze.dati) return <Caricamento />

  const perUid = new Map(preferenze.dati.map((d) => [d.id, d]))
  const nome = (uid: string) => p.studenti.find((s) => s.uid === uid)?.nome ?? 'Ex membro'
  const studentiUid = new Set(p.studenti.map((s) => s.uid))
  const risposte = preferenze.dati.filter((d) => studentiUid.has(d.id))
  const senzaRisposta = p.studenti.filter((s) => !perUid.has(s.uid))

  async function genera() {
    if (!db) return
    const ok = await conferma({
      titolo: 'Generare la lista adesso?',
      testo: 'Il sorteggio si fa una volta sola. Dopo potrai comunque riordinare la lista a mano.',
      pulsante: 'Genera lista',
    })
    if (!ok) return
    setInCorso(true)
    setErrore(null)
    try {
      await generaEPubblicaLista(db, p, p.mioUid)
      avvisi.mostra('Lista generata: ora la vedono tutti')
    } catch (e) {
      setErrore(messaggioErrore(e))
      setInCorso(false)
    }
  }

  return (
    <Scheda titolo={`Preferenze ricevute (${risposte.length}/${p.studenti.length})`}>
      <div className="space-y-4 text-sm">
        <ul className="space-y-1.5">
          {ORDINE_SCELTE.map((s) => {
            const chi = risposte.filter((d) => d.scelta === s)
            if (chi.length === 0) return null
            return (
              <li key={s}>
                <strong>{ETICHETTA_SCELTA[s]}</strong> ({chi.length}):{' '}
                {chi
                  .map((d) => (s === 'posizione' ? `${nome(d.id)} (n° ${d.posizioneDSA})` : nome(d.id)))
                  .sort((a, b) => a.localeCompare(b, 'it'))
                  .join(', ')}
              </li>
            )
          })}
          {senzaRisposta.length > 0 && (
            <li className="text-slate-500">
              <strong>Non hanno risposto</strong> ({senzaRisposta.length}):{' '}
              {senzaRisposta.map((s) => s.nome).sort((a, b) => a.localeCompare(b, 'it')).join(', ')}
            </li>
          )}
        </ul>

        {p.scaduta ? (
          <div className="space-y-2">
            <p>Le preferenze sono chiuse: puoi generare la lista.</p>
            <Bottone onClick={genera} disabled={inCorso}>
              {inCorso ? 'Generazione…' : 'Genera lista'}
            </Bottone>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-500">
              Potrai generare la lista dopo la scadenza. Se tutti hanno già risposto, puoi anticipare la scadenza da
              "Modifica".
            </p>
            <Condividi
              etichetta={senzaRisposta.length > 0 ? 'Promemoria per chi non ha scelto' : 'Messaggio per la classe'}
              titolo={`${p.nomeMateria} – ${p.nomeInterrogazione}`}
              testo={messaggioPromemoria({
                interrogazione: p.nomeInterrogazione,
                materia: p.nomeMateria,
                scadenza: p.scadenza,
                link: linkAssoluto(percorsoInterrogazione(p.classId, p.subjectId, p.interrogazioneId)),
                mancanti: senzaRisposta.length,
              })}
            />
          </div>
        )}
        {errore && <Riquadro tono="errore">{errore}</Riquadro>}
      </div>
    </Scheda>
  )
}
