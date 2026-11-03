import { useState } from 'react'
import { db } from '../lib/firebase'
import { cediRuolo } from '../lib/classi'
import { messaggioErrore } from '../lib/errori'
import type { Membro } from '../lib/tipi'
import { useAvvisi } from './Avvisi'
import { useConferma } from './Conferma'
import { Bottone, CLASSE_INPUT, Etichetta } from './ui'

/** Il capoclasse passa il ruolo a un compagno (non a un docente). */
export function CediRuolo({ classId, mioUid, studenti }: { classId: string; mioUid: string; studenti: Membro[] }) {
  const candidati = studenti.filter((m) => m.uid !== mioUid && (m.ruolo === 'studente' || m.ruolo === 'vice'))
  const [scelto, setScelto] = useState('')
  const [restaVice, setRestaVice] = useState(true)
  const [inCorso, setInCorso] = useState(false)
  const avvisi = useAvvisi()
  const conferma = useConferma()
  const nuovo = candidati.find((m) => m.uid === scelto)

  async function cedi() {
    if (!db || !nuovo) return
    const ok = await conferma({
      titolo: `Passare il ruolo a ${nuovo.nome}?`,
      testo: `${nuovo.nome} diventerà capoclasse e tu ${restaVice ? 'resterai vice' : 'tornerai studente'}. Per riaverlo dovrà ripassartelo.`,
      pulsante: 'Passa il ruolo',
    })
    if (!ok) return
    setInCorso(true)
    try {
      await cediRuolo(db, classId, mioUid, nuovo.uid, restaVice)
      avvisi.mostra(`${nuovo.nome} è il nuovo capoclasse`)
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
      setInCorso(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Passa il ruolo di capoclasse</p>
      {candidati.length === 0 ? (
        <p className="text-sm text-slate-500">Nella classe non ci sono ancora altri studenti.</p>
      ) : (
        <>
          <Etichetta testo="Nuovo capoclasse">
            <select value={scelto} onChange={(e) => setScelto(e.target.value)} className={`${CLASSE_INPUT} max-w-72`}>
              <option value="">Scegli un compagno…</option>
              {candidati.map((m) => (
                <option key={m.uid} value={m.uid}>
                  {m.nome}
                  {m.ruolo === 'vice' ? ' (vice)' : ''}
                </option>
              ))}
            </select>
          </Etichetta>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={restaVice} onChange={(e) => setRestaVice(e.target.checked)} className="size-4 accent-accento" />
            Resto vice
          </label>
          <Bottone variante="secondario" onClick={cedi} disabled={!nuovo || inCorso}>
            Passa il ruolo
          </Bottone>
        </>
      )}
    </div>
  )
}
