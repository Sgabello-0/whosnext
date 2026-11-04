import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { db } from '../lib/firebase'
import { richiediPermesso, rimuoviMembro } from '../lib/classi'
import { messaggioErrore } from '../lib/errori'
import { dividiMembri, ETICHETTA_RUOLO, puoGestireDSA, puoModificareListe } from '../lib/membri'
import { ProviderRaccolta } from '../lib/raccolta'
import { OsservaClasse } from '../components/osservatori/Osservatori'
import { PannelloDaFare } from '../components/osservatori/Pannelli'
import { Guida } from '../components/Guida'
import { useClasse } from '../lib/useClasse'
import type { Membro } from '../lib/tipi'
import { ListaMembri } from '../components/ListaMembri'
import { useAvvisi } from '../components/Avvisi'
import { useConferma } from '../components/Conferma'
import { Invito } from '../components/Invito'
import { InterrogazioniClasse } from '../components/InterrogazioniClasse'
import { StatoClasse } from '../components/StatoClasse'
import { Avatar, Bottone, IntestazionePagina, LinkBottone, Riquadro, Soffietto } from '../components/ui'
import { ArrowLeftRight, BadgeCheck, Eye, GraduationCap, LogOut, Settings, Sparkles, Users } from 'lucide-react'
import { impostaRifiutaScambi } from '../lib/scambi'

export default function Classe() {
  const { classId = '' } = useParams()
  const dati = useClasse(classId)
  if (dati.stato !== 'pronto') return <StatoClasse dati={dati} />

  const { classe, io, membri, dsa } = dati
  const { studenti, docenti } = dividiMembri(membri)
  const staff = puoGestireDSA(io)

  return (
    <>
      <IntestazionePagina
        indietro={{ to: '/', testo: 'Le tue classi' }}
        titolo={classe.nome}
        sottotitolo={
          <>
            {studenti.length} {studenti.length === 1 ? 'studente' : 'studenti'}
            {docenti.length > 0 && ` · ${docenti.length} ${docenti.length === 1 ? 'docente' : 'docenti'}`} · tu sei{' '}
            {ETICHETTA_RUOLO[io.ruolo].toLowerCase()}
          </>
        }
        azioni={
          staff && (
            <LinkBottone to={`/classe/${classId}/gestione`} icona={Settings}>
              Gestisci classe
            </LinkBottone>
          )
        }
      />

      {io.ruolo === 'docente' && <PermessoDocente classId={classId} io={io} />}
      {!staff && dsa.has(io.uid) && (
        <Riquadro tono="info" icona={Sparkles}>
          Hai il badge <strong>DSA/BES</strong>: per ogni interrogazione potrai scegliere la posizione esatta nella
          lista. Il badge lo vedono solo il capoclasse e il vice.
        </Riquadro>
      )}

      {puoModificareListe(io) && (
        <ProviderRaccolta>
          <OsservaClasse classId={classId} membro={io} />
          {io.ruolo === 'capo' && (
            <Guida classId={classId} nomeClasse={classe.nome} codice={classe.codiceInvito} numeroMembri={membri.length} />
          )}
          <PannelloDaFare classId={classId} />
        </ProviderRaccolta>
      )}

      <InterrogazioniClasse classId={classId} staff={staff} mioUid={io.uid} />

      {io.ruolo !== 'docente' && <ImpostazioneScambi classId={classId} io={io} />}

      <Soffietto
        titolo={`Studenti (${studenti.length})`}
        icona={Users}
        aperto={studenti.length <= 6}
        destra={<PilaAvatar membri={studenti} />}
      >
        <ListaMembri membri={studenti} mioUid={io.uid} dsa={staff ? dsa : new Set()} />
      </Soffietto>

      {docenti.length > 0 && (
        <Soffietto titolo={`Docenti (${docenti.length})`} icona={GraduationCap} aperto={docenti.length <= 3}>
          <ListaMembri membri={docenti} mioUid={io.uid} dsa={new Set()} />
        </Soffietto>
      )}

      <Invito codice={classe.codiceInvito} nomeClasse={classe.nome} />

      {io.ruolo !== 'capo' && <EsciDallaClasse classId={classId} uid={io.uid} nomeClasse={classe.nome} />}
    </>
  )
}

/** Le prime facce della classe, sovrapposte (accanto al titolo chiuso). */
function PilaAvatar({ membri }: { membri: Membro[] }) {
  return (
    <span className="flex -space-x-2 group-open:hidden" aria-hidden>
      {membri.slice(0, 5).map((m) => (
        <Avatar key={m.uid} nome={m.nome} foto={m.foto} piccolo />
      ))}
    </span>
  )
}

/** "Rifiuta in automatico" le richieste di scambio (vale per tutte le interrogazioni della classe). */
function ImpostazioneScambi({ classId, io }: { classId: string; io: Membro }) {
  const avvisi = useAvvisi()
  const [inCorso, setInCorso] = useState(false)
  const salvato = !!io.rifiutaScambi
  // L'interruttore si sposta subito; torna com'era se il salvataggio non riesce
  const [rifiuta, setRifiuta] = useState(salvato)
  const [ultimoSalvato, setUltimoSalvato] = useState(salvato)
  if (salvato !== ultimoSalvato) {
    setUltimoSalvato(salvato)
    setRifiuta(salvato)
  }

  async function cambia(valore: boolean) {
    if (!db) return
    const d = db
    setRifiuta(valore)
    setInCorso(true)
    try {
      await impostaRifiutaScambi(d, classId, io.uid, valore)
      avvisi.mostra(valore ? 'Da ora rifiuti in automatico le richieste di scambio' : 'Da ora ricevi le richieste di scambio', {
        annulla: () => impostaRifiutaScambi(d, classId, io.uid, !valore),
      })
    } catch (e) {
      setRifiuta(!valore)
      avvisi.errore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:px-5 dark:border-slate-800 dark:bg-slate-900">
      <ArrowLeftRight aria-hidden className="mt-0.5 size-4.5 shrink-0 text-slate-500" />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Rifiuta in automatico gli scambi</span>
        <span className="mt-0.5 block text-sm text-slate-500">
          {rifiuta
            ? 'Nessuno può chiederti di scambiare il posto nelle liste di questa classe.'
            : 'I compagni possono chiederti di scambiare il posto: decidi tu se accettare.'}
        </span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={rifiuta}
        disabled={inCorso}
        onChange={(e) => cambia(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-accento"
      />
    </label>
  )
}

function PermessoDocente({ classId, io }: { classId: string; io: Membro }) {
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()

  async function imposta(richiesta: boolean) {
    if (!db) return
    setInCorso(true)
    setErrore(null)
    try {
      await richiediPermesso(db, classId, io.uid, richiesta)
      avvisi.mostra(richiesta ? 'Richiesta inviata al capoclasse' : 'Richiesta ritirata')
    } catch (e) {
      setErrore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  if (io.permessoModifica) {
    return (
      <Riquadro tono="ok" titolo="Puoi modificare le liste" icona={BadgeCheck}>
        Il capoclasse ti ha dato il permesso: puoi riordinare le liste e segnare chi è stato interrogato.
      </Riquadro>
    )
  }
  return (
    <Riquadro tono="info" titolo="Accesso in sola lettura" icona={Eye}>
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
  const avvisi = useAvvisi()
  const conferma = useConferma()

  async function esci() {
    if (!db) return
    const ok = await conferma({
      titolo: `Uscire da ${nomeClasse}?`,
      testo: "Per rientrare servirà di nuovo il codice d'invito.",
      pulsante: 'Esci dalla classe',
      pericolo: true,
    })
    if (!ok) return
    try {
      await rimuoviMembro(db, classId, uid)
      avvisi.mostra(`Sei uscito da ${nomeClasse}`)
      navigate('/', { replace: true })
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  return (
    <div className="flex flex-col items-center pt-2">
      <Bottone variante="pericolo" icona={LogOut} onClick={esci}>
        Esci dalla classe
      </Bottone>
      {errore && <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
    </div>
  )
}
