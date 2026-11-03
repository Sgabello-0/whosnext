import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useProfilo } from '../lib/auth'
import { db } from '../lib/firebase'
import { giaMembro, leggiInvito, uniscitiConCodice } from '../lib/classi'
import { formattaCodice, normalizzaCodice } from '../lib/codici'
import { messaggioErrore } from '../lib/errori'
import type { Invito } from '../lib/tipi'
import { Bottone, Caricamento, LinkBottone, Riquadro, Scheda } from '../components/ui'
import { DoorOpen, Eye, SearchX } from 'lucide-react'
import { useAvvisi } from '../components/Avvisi'

type Stato =
  | { fase: 'caricamento' }
  | { fase: 'inesistente' }
  | { fase: 'errore'; messaggio: string }
  | { fase: 'pronto'; invito: Invito }
  | { fase: 'gia-membro'; classId: string }

/** Pagina del link d'invito: /unisciti/ABCDEF (anche dal QR code). */
export default function Unisciti() {
  const { codice: grezzo = '' } = useParams()
  const codice = normalizzaCodice(grezzo)
  const profilo = useProfilo()
  const navigate = useNavigate()
  const [stato, setStato] = useState<Stato>({ fase: 'caricamento' })
  const [inCorso, setInCorso] = useState(false)
  const [erroreEntrata, setErroreEntrata] = useState<string | null>(null)
  const avvisi = useAvvisi()

  useEffect(() => {
    if (!db || !codice) return
    const database = db
    let annullato = false
    ;(async () => {
      try {
        const invito = await leggiInvito(database, codice)
        if (annullato) return
        if (!invito) return setStato({ fase: 'inesistente' })
        if (await giaMembro(database, invito.classId, profilo.uid)) {
          if (!annullato) setStato({ fase: 'gia-membro', classId: invito.classId })
          return
        }
        if (!annullato) setStato({ fase: 'pronto', invito })
      } catch (e) {
        if (!annullato) setStato({ fase: 'errore', messaggio: messaggioErrore(e) })
      }
    })()
    return () => {
      annullato = true
    }
  }, [codice, profilo.uid])

  async function entra() {
    if (!db || !codice) return
    setInCorso(true)
    setErroreEntrata(null)
    try {
      const { classId } = await uniscitiConCodice(db, profilo, codice)
      if (stato.fase === 'pronto') avvisi.mostra(`Sei entrato in ${stato.invito.nomeClasse}`)
      navigate(`/classe/${classId}`, { replace: true })
    } catch (e) {
      setErroreEntrata(messaggioErrore(e))
      setInCorso(false)
    }
  }

  if (!codice || stato.fase === 'inesistente') {
    return (
      <Scheda titolo="Codice non valido" icona={SearchX}>
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Il codice <strong className="font-mono">{grezzo}</strong> non esiste o è stato cambiato dal capoclasse.
          Chiedigli quello nuovo.
        </p>
        <LinkBottone to="/">Torna alle tue classi</LinkBottone>
      </Scheda>
    )
  }
  if (stato.fase === 'gia-membro') return <Navigate to={`/classe/${stato.classId}`} replace />
  if (stato.fase === 'caricamento') return <Caricamento testo="Controllo il codice…" />
  if (stato.fase === 'errore') return <Riquadro tono="errore">{stato.messaggio}</Riquadro>

  return (
    <Scheda titolo="Entra nella classe" icona={DoorOpen} tono="evidenza">
      <div className="space-y-4">
        <p>
          Stai per entrare in <strong>{stato.invito.nomeClasse}</strong> come{' '}
          <strong>{profilo.tipo === 'docente' ? 'docente' : 'studente'}</strong>.
        </p>
        <p className="font-mono text-sm text-slate-500">Codice {formattaCodice(codice)}</p>
        {profilo.tipo === 'docente' && (
          <Riquadro tono="info" icona={Eye}>
            Come docente vedrai le liste delle interrogazioni. Per modificarle potrai chiedere il permesso al
            capoclasse.
          </Riquadro>
        )}
        {erroreEntrata && <Riquadro tono="errore">{erroreEntrata}</Riquadro>}
        <div className="flex flex-wrap gap-2">
          <Bottone onClick={entra} disabled={inCorso} icona={DoorOpen}>
            {inCorso ? 'Entro…' : 'Entra'}
          </Bottone>
          <LinkBottone to="/">Annulla</LinkBottone>
        </div>
      </div>
    </Scheda>
  )
}
