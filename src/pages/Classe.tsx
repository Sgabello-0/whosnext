import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
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
import { Avatar, Bottone, Colonne, IntestazionePagina, LinkBottone, Riquadro, Soffietto } from '../components/ui'
import { useDesktop } from '../lib/useDesktop'
import { BadgeCheck, Eye, GraduationCap, LogOut, Settings, Sparkles, Users } from 'lucide-react'

export default function Classe() {
  const { classId = '' } = useParams()
  const dati = useClasse(classId)
  const desktop = useDesktop()
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

      <Colonne
        desktop={desktop}
        principale={
          <>
            {io.ruolo === 'docente' && <PermessoDocente classId={classId} io={io} />}
            {!staff && dsa.has(io.uid) && (
              <Riquadro tono="info" icona={Sparkles}>
                Hai il badge <strong>DSA/BES</strong>: per ogni interrogazione puoi scegliere il giorno in cui essere interrogato.
                Lo vedono solo capoclasse e vice; se vuoi puoi mostrarlo ai compagni dalle{' '}
                <Link to="/impostazioni" className="font-semibold underline">
                  Impostazioni
                </Link>
                .
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
          </>
        }
        laterale={
          <>
            <Soffietto
              titolo={`Studenti (${studenti.length})`}
              icona={Users}
              aperto={studenti.length <= 6}
              destra={<PilaAvatar membri={studenti} />}
            >
              <ListaMembri membri={studenti} mioUid={io.uid} dsa={dsa} />
            </Soffietto>

            {docenti.length > 0 && (
              <Soffietto titolo={`Docenti (${docenti.length})`} icona={GraduationCap} aperto={docenti.length <= 3}>
                <ListaMembri membri={docenti} mioUid={io.uid} dsa={new Set()} />
              </Soffietto>
            )}

            <Invito codice={classe.codiceInvito} nomeClasse={classe.nome} />

            {io.ruolo !== 'capo' && <EsciDallaClasse classId={classId} uid={io.uid} nomeClasse={classe.nome} />}
          </>
        }
      />
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
