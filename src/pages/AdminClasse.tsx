import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { db } from '../lib/firebase'
import {
  cambiaCodiceInvito,
  impostaDSA,
  impostaPermessoDocente,
  impostaVice,
  rimuoviMembro,
  rinominaClasse,
} from '../lib/classi'
import { formattaCodice } from '../lib/codici'
import { eliminaClasse } from '../lib/eliminaClasse'
import { messaggioErrore } from '../lib/errori'
import { dividiMembri, puoGestireDSA } from '../lib/membri'
import { useClasse } from '../lib/useClasse'
import type { Membro } from '../lib/tipi'
import { ListaMembri } from '../components/ListaMembri'
import { StatoClasse } from '../components/StatoClasse'
import { Avatar, Bottone, Campo, LinkBottone, Riquadro, Scheda } from '../components/ui'

/** Gestione della classe: capoclasse (tutto) e vice (solo badge DSA/BES). */
export default function AdminClasse() {
  const { classId = '' } = useParams()
  const dati = useClasse(classId)
  const [errore, setErrore] = useState<string | null>(null)
  const [occupato, setOccupato] = useState<string | null>(null)

  if (dati.stato !== 'pronto') return <StatoClasse dati={dati} />
  const { classe, io, membri, dsa } = dati

  if (!puoGestireDSA(io)) {
    return (
      <Scheda titolo="Solo per capoclasse e vice">
        <LinkBottone to={`/classe/${classId}`}>Torna alla classe</LinkBottone>
      </Scheda>
    )
  }

  const capo = io.ruolo === 'capo'
  const { studenti, docenti } = dividiMembri(membri)
  const richieste = docenti.filter((d) => d.richiestaPermesso && !d.permessoModifica)

  /** Esegue un'azione mostrando l'errore se fallisce; `chiave` disabilita i pulsanti di quel membro. */
  async function esegui(chiave: string, azione: () => Promise<unknown>) {
    setErrore(null)
    setOccupato(chiave)
    try {
      await azione()
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setOccupato(null)
    }
  }

  function azioniStudente(m: Membro) {
    if (!db) return null
    const d = db
    const haDSA = dsa.has(m.uid)
    const occ = occupato === m.uid
    return (
      <>
        <Bottone variante="piccolo" disabled={occ} onClick={() => esegui(m.uid, () => impostaDSA(d, classId, m.uid, !haDSA, io.uid))}>
          {haDSA ? 'Togli DSA/BES' : 'Dai DSA/BES'}
        </Bottone>
        {capo && m.ruolo !== 'capo' && (
          <Bottone
            variante="piccolo"
            disabled={occ}
            onClick={() => esegui(m.uid, () => impostaVice(d, classId, m.uid, m.ruolo !== 'vice'))}
          >
            {m.ruolo === 'vice' ? 'Togli vice' : 'Nomina vice'}
          </Bottone>
        )}
        {capo && m.ruolo !== 'capo' && (
          <Bottone variante="piccolo" disabled={occ} onClick={() => rimuovi(m)}>
            Rimuovi
          </Bottone>
        )}
      </>
    )
  }

  function azioniDocente(m: Membro) {
    if (!db || !capo) return null
    const d = db
    const occ = occupato === m.uid
    return (
      <>
        <Bottone
          variante="piccolo"
          disabled={occ}
          onClick={() => esegui(m.uid, () => impostaPermessoDocente(d, classId, m.uid, !m.permessoModifica))}
        >
          {m.permessoModifica ? 'Togli permesso' : 'Dai permesso'}
        </Bottone>
        <Bottone variante="piccolo" disabled={occ} onClick={() => rimuovi(m)}>
          Rimuovi
        </Bottone>
      </>
    )
  }

  function rimuovi(m: Membro) {
    if (!db) return
    const d = db
    if (!confirm(`Sei sicuro di voler rimuovere ${m.nome} dalla classe?\n\nPotrà rientrare solo con il codice d'invito: se serve, cambialo.`)) return
    esegui(m.uid, () => rimuoviMembro(d, classId, m.uid))
  }

  return (
    <>
      <div>
        <Link to={`/classe/${classId}`} className="text-sm text-accento hover:underline dark:text-blue-300">
          ← {classe.nome}
        </Link>
        <h1 className="text-2xl font-semibold">Gestisci classe</h1>
        {!capo && <p className="text-sm text-slate-500">Come vice puoi dare e togliere il badge DSA/BES.</p>}
      </div>

      {errore && <Riquadro tono="errore">{errore}</Riquadro>}

      {capo && richieste.length > 0 && (
        <Scheda titolo="Richieste di permesso dei docenti">
          <ul className="space-y-3">
            {richieste.map((m) => (
              <li key={m.uid} className="flex flex-wrap items-center gap-3">
                <Avatar nome={m.nome} foto={m.foto} />
                <span className="min-w-0 flex-1">
                  <strong>{m.nome}</strong> chiede di poter modificare le liste
                </span>
                <span className="flex gap-1.5">
                  <Bottone
                    variante="piccolo"
                    disabled={occupato === m.uid}
                    onClick={() => db && esegui(m.uid, () => impostaPermessoDocente(db!, classId, m.uid, true))}
                  >
                    Accetta
                  </Bottone>
                  <Bottone
                    variante="piccolo"
                    disabled={occupato === m.uid}
                    onClick={() => db && esegui(m.uid, () => impostaPermessoDocente(db!, classId, m.uid, false))}
                  >
                    Rifiuta
                  </Bottone>
                </span>
              </li>
            ))}
          </ul>
        </Scheda>
      )}

      <Scheda titolo={`Studenti (${studenti.length})`}>
        <p className="mb-2 text-sm text-slate-500">
          Il badge DSA/BES permette di scegliere la posizione esatta nelle liste. Lo vedono solo capoclasse, vice e il
          diretto interessato.
        </p>
        <ListaMembri membri={studenti} mioUid={io.uid} dsa={dsa} mostraEmail azioni={azioniStudente} />
      </Scheda>

      <Scheda titolo={`Docenti (${docenti.length})`}>
        <p className="mb-2 text-sm text-slate-500">
          I docenti vedono le liste. Con il permesso possono anche riordinarle e segnare chi è stato interrogato.
        </p>
        <ListaMembri membri={docenti} mioUid={io.uid} dsa={new Set()} mostraEmail azioni={azioniDocente} />
      </Scheda>

      {capo && <ImpostazioniClasse classId={classId} nome={classe.nome} codice={classe.codiceInvito} />}
    </>
  )
}

function ImpostazioniClasse({ classId, nome, codice }: { classId: string; nome: string; codice: string }) {
  const [nuovoNome, setNuovoNome] = useState(nome)
  const [messaggio, setMessaggio] = useState<{ tono: 'ok' | 'errore'; testo: string } | null>(null)
  const [inCorso, setInCorso] = useState(false)

  async function esegui(azione: () => Promise<string>) {
    setInCorso(true)
    setMessaggio(null)
    try {
      setMessaggio({ tono: 'ok', testo: await azione() })
    } catch (e) {
      setMessaggio({ tono: 'errore', testo: messaggioErrore(e) })
    } finally {
      setInCorso(false)
    }
  }

  function rinomina(e: FormEvent) {
    e.preventDefault()
    if (!db) return
    const d = db
    esegui(async () => {
      await rinominaClasse(d, classId, codice, nuovoNome)
      return 'Nome aggiornato.'
    })
  }

  function cambiaCodice() {
    if (!db) return
    const d = db
    if (!confirm(`Il codice ${formattaCodice(codice)} smetterà di funzionare, anche il link e il QR code. Chi è già nella classe resta. Continuare?`)) return
    esegui(async () => `Nuovo codice: ${formattaCodice(await cambiaCodiceInvito(d, classId, nome, codice))}`)
  }

  return (
    <Scheda titolo="Impostazioni della classe">
      <div className="space-y-5">
        <form onSubmit={rinomina} className="space-y-3">
          <Campo etichetta="Nome della classe" valore={nuovoNome} onChange={setNuovoNome} maxLength={60} />
          <Bottone type="submit" variante="secondario" disabled={inCorso || !nuovoNome.trim() || nuovoNome.trim() === nome}>
            Rinomina
          </Bottone>
        </form>
        <div className="space-y-2">
          <p className="text-sm font-medium">Codice d'invito: <span className="font-mono">{formattaCodice(codice)}</span></p>
          <p className="text-sm text-slate-500">
            Se il codice è finito nelle mani sbagliate, o dopo aver rimosso qualcuno, cambialo.
          </p>
          <Bottone variante="secondario" onClick={cambiaCodice} disabled={inCorso}>
            Cambia codice d'invito
          </Bottone>
        </div>
        {messaggio && <Riquadro tono={messaggio.tono}>{messaggio.testo}</Riquadro>}
        <EliminaClasse classId={classId} nome={nome} codice={codice} />
      </div>
    </Scheda>
  )
}

function EliminaClasse({ classId, nome, codice }: { classId: string; nome: string; codice: string }) {
  const navigate = useNavigate()
  const [conferma, setConferma] = useState('')
  const [aperto, setAperto] = useState(false)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function elimina(e: FormEvent) {
    e.preventDefault()
    if (!db || conferma.trim() !== nome) return
    setInCorso(true)
    setErrore(null)
    try {
      await eliminaClasse(db, classId, codice)
      navigate('/', { replace: true })
    } catch (err) {
      setErrore(messaggioErrore(err))
      setInCorso(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-rose-200 p-3 dark:border-rose-900">
      <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Elimina la classe</p>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Spariscono per tutti membri, materie, interrogazioni e calendario. Non si può annullare.
      </p>
      {!aperto ? (
        <Bottone variante="pericolo" onClick={() => setAperto(true)}>
          Elimina classe…
        </Bottone>
      ) : (
        <form onSubmit={elimina} className="space-y-3">
          <Campo
            etichetta={`Per confermare scrivi il nome della classe: ${nome}`}
            valore={conferma}
            onChange={setConferma}
            maxLength={60}
          />
          {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
          <div className="flex flex-wrap gap-2">
            <Bottone type="submit" variante="pericolo" disabled={inCorso || conferma.trim() !== nome}>
              {inCorso ? 'Eliminazione…' : 'Elimina definitivamente'}
            </Bottone>
            <Bottone
              variante="secondario"
              onClick={() => {
                setAperto(false)
                setConferma('')
              }}
            >
              Annulla
            </Bottone>
          </div>
        </form>
      )}
    </div>
  )
}
