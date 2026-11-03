import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { db } from '../lib/firebase'
import { richiediPermesso, rimuoviMembro } from '../lib/classi'
import { messaggioErrore } from '../lib/errori'
import { dividiMembri, ETICHETTA_RUOLO, puoGestireDSA } from '../lib/membri'
import { useClasse } from '../lib/useClasse'
import type { Membro } from '../lib/tipi'
import { ListaMembri } from '../components/ListaMembri'
import { Invito } from '../components/Invito'
import { InterrogazioniClasse } from '../components/InterrogazioniClasse'
import { StatoClasse } from '../components/StatoClasse'
import { Bottone, LinkBottone, Riquadro, Scheda } from '../components/ui'

export default function Classe() {
  const { classId = '' } = useParams()
  const dati = useClasse(classId)
  if (dati.stato !== 'pronto') return <StatoClasse dati={dati} />

  const { classe, io, membri, dsa } = dati
  const { studenti, docenti } = dividiMembri(membri)
  const staff = puoGestireDSA(io)

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold break-words">{classe.nome}</h1>
          <p className="text-sm text-slate-500">
            {studenti.length} {studenti.length === 1 ? 'studente' : 'studenti'}
            {docenti.length > 0 && ` · ${docenti.length} ${docenti.length === 1 ? 'docente' : 'docenti'}`} · tu sei{' '}
            {ETICHETTA_RUOLO[io.ruolo].toLowerCase()}
          </p>
        </div>
        {staff && <LinkBottone to={`/classe/${classId}/gestione`}>Gestisci classe</LinkBottone>}
      </div>

      {io.ruolo === 'docente' && <PermessoDocente classId={classId} io={io} />}
      {!staff && dsa.has(io.uid) && (
        <Riquadro tono="info">
          Hai il badge <strong>DSA/BES</strong>: per ogni interrogazione potrai scegliere la posizione esatta nella
          lista. Il badge lo vedono solo il capoclasse e il vice.
        </Riquadro>
      )}

      <InterrogazioniClasse classId={classId} staff={staff} />

      <Invito codice={classe.codiceInvito} nomeClasse={classe.nome} />

      <Scheda titolo={`Studenti (${studenti.length})`}>
        <ListaMembri membri={studenti} mioUid={io.uid} dsa={staff ? dsa : new Set()} />
      </Scheda>

      {docenti.length > 0 && (
        <Scheda titolo={`Docenti (${docenti.length})`}>
          <ListaMembri membri={docenti} mioUid={io.uid} dsa={new Set()} />
        </Scheda>
      )}

      {io.ruolo !== 'capo' && <EsciDallaClasse classId={classId} uid={io.uid} nomeClasse={classe.nome} />}
    </>
  )
}

function PermessoDocente({ classId, io }: { classId: string; io: Membro }) {
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function imposta(richiesta: boolean) {
    if (!db) return
    setInCorso(true)
    setErrore(null)
    try {
      await richiediPermesso(db, classId, io.uid, richiesta)
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  if (io.permessoModifica) {
    return (
      <Riquadro tono="ok" titolo="Puoi modificare le liste">
        Il capoclasse ti ha dato il permesso: puoi riordinare le liste e segnare chi è stato interrogato.
      </Riquadro>
    )
  }
  return (
    <Riquadro tono="info" titolo="Accesso in sola lettura">
      <p>Come docente vedi le liste ma non puoi modificarle. Puoi chiedere il permesso al capoclasse.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {io.richiestaPermesso ? (
          <>
            <span className="font-medium">Richiesta inviata, in attesa del capoclasse.</span>
            <Bottone variante="piccolo" onClick={() => imposta(false)} disabled={inCorso}>
              Annulla richiesta
            </Bottone>
          </>
        ) : (
          <Bottone variante="piccolo" onClick={() => imposta(true)} disabled={inCorso}>
            Chiedi il permesso di modifica
          </Bottone>
        )}
      </div>
      {errore && <p className="mt-2 text-rose-700 dark:text-rose-300">{errore}</p>}
    </Riquadro>
  )
}

function EsciDallaClasse({ classId, uid, nomeClasse }: { classId: string; uid: string; nomeClasse: string }) {
  const navigate = useNavigate()
  const [errore, setErrore] = useState<string | null>(null)

  async function esci() {
    if (!db) return
    if (!confirm(`Sei sicuro di voler uscire da ${nomeClasse}? Per rientrare servirà di nuovo il codice d'invito.`)) return
    try {
      await rimuoviMembro(db, classId, uid)
      navigate('/', { replace: true })
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  return (
    <div className="pt-2">
      <Bottone variante="pericolo" onClick={esci}>
        Esci dalla classe
      </Bottone>
      {errore && <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
    </div>
  )
}
