import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useProfilo } from '../lib/auth'
import { db } from '../lib/firebase'
import { creaClasse, queryMieIscrizioni, rifClasse } from '../lib/classi'
import { codiceDaTesto } from '../lib/codici'
import { messaggioErrore } from '../lib/errori'
import { useDocumento, useQuery } from '../lib/hooks'
import { ETICHETTA_RUOLO } from '../lib/membri'
import type { Classe, Membro } from '../lib/tipi'
import { Badge, Bottone, Caricamento, Campo, Riquadro, Scheda } from '../components/ui'

/** classes/{classId}/members/{uid} → classId */
function classIdDa(percorso: string): string {
  return percorso.split('/')[1] ?? ''
}

export default function Classi() {
  const profilo = useProfilo()
  const iscrizioni = useQuery<Membro>(db && queryMieIscrizioni(db, profilo.uid), `iscrizioni/${profilo.uid}`)

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Ciao {profilo.nome.split(' ')[0]}</h1>
        <p className="text-slate-600 dark:text-slate-400">
          {profilo.tipo === 'docente'
            ? 'Account docente: vedi le liste delle classi in cui entri.'
            : 'Le tue classi e le loro interrogazioni.'}
        </p>
      </div>

      <Scheda titolo="Le tue classi">
        {iscrizioni.errore ? (
          <Riquadro tono="errore">{messaggioErrore(iscrizioni.errore)}</Riquadro>
        ) : !iscrizioni.dati ? (
          <Caricamento />
        ) : iscrizioni.dati.length === 0 ? (
          <p className="text-sm text-slate-500">
            Non sei ancora in nessuna classe.{' '}
            {profilo.tipo === 'studente'
              ? 'Unisciti con il codice del capoclasse oppure creane una.'
              : 'Chiedi al capoclasse il codice d\'invito.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {iscrizioni.dati.map((m) => (
              <RigaClasse key={m.percorso} classId={classIdDa(m.percorso)} membro={m} />
            ))}
          </ul>
        )}
      </Scheda>

      <Unisciti />
      {profilo.tipo === 'studente' && <CreaClasse />}
    </>
  )
}

function RigaClasse({ classId, membro }: { classId: string; membro: Membro }) {
  const classe = useDocumento<Classe>(db && rifClasse(db, classId))
  return (
    <li>
      <Link
        to={`/classe/${classId}`}
        className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <span className="truncate font-medium">{classe.dati?.nome ?? '…'}</span>
        <Badge colore={membro.ruolo === 'capo' ? 'blu' : membro.ruolo === 'docente' ? 'viola' : 'grigio'}>
          {ETICHETTA_RUOLO[membro.ruolo]}
        </Badge>
      </Link>
    </li>
  )
}

function Unisciti() {
  const navigate = useNavigate()
  const [testo, setTesto] = useState('')
  const [errore, setErrore] = useState<string | null>(null)

  function invia(e: FormEvent) {
    e.preventDefault()
    const codice = codiceDaTesto(testo)
    if (!codice) {
      setErrore('Il codice è di 6 caratteri, ad esempio ABC-DEF. Puoi anche incollare il link d\'invito.')
      return
    }
    navigate(`/unisciti/${codice}`)
  }

  return (
    <Scheda titolo="Unisciti a una classe">
      <form onSubmit={invia} className="space-y-3">
        <Campo
          etichetta="Codice o link d'invito"
          valore={testo}
          onChange={(v) => {
            setTesto(v)
            setErrore(null)
          }}
          placeholder="ABC-DEF"
          maxLength={200}
        />
        {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
        <Bottone type="submit" disabled={!testo.trim()}>
          Continua
        </Bottone>
      </form>
    </Scheda>
  )
}

function CreaClasse() {
  const profilo = useProfilo()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function invia(e: FormEvent) {
    e.preventDefault()
    if (!db) return
    setInCorso(true)
    setErrore(null)
    try {
      const { classId } = await creaClasse(db, profilo, nome)
      navigate(`/classe/${classId}`)
    } catch (err) {
      setErrore(messaggioErrore(err))
      setInCorso(false)
    }
  }

  return (
    <Scheda titolo="Crea una classe">
      <form onSubmit={invia} className="space-y-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Chi crea la classe ne diventa il <strong>capoclasse</strong>: configura materie e interrogazioni e gestisce
          i compagni.
        </p>
        <Campo etichetta="Nome della classe" valore={nome} onChange={setNome} placeholder="Es. 4ªB Informatica" maxLength={60} />
        {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
        <Bottone type="submit" disabled={inCorso || !nome.trim()}>
          {inCorso ? 'Creazione…' : 'Crea classe'}
        </Bottone>
      </form>
    </Scheda>
  )
}
