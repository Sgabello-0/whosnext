import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { KeyRound, Plus, School, Users } from 'lucide-react'
import { useProfilo } from '../lib/auth'
import { db } from '../lib/firebase'
import { creaClasse, queryMieIscrizioni, rifClasse } from '../lib/classi'
import { codiceDaTesto } from '../lib/codici'
import { messaggioErrore } from '../lib/errori'
import { useDocumento, useQuery } from '../lib/hooks'
import { ETICHETTA_RUOLO } from '../lib/membri'
import type { Classe, Membro } from '../lib/tipi'
import { Badge, Bottone, Caricamento, Campo, Colonne, Modulo, Pallino, Riquadro, RigaLink, Scheda } from '../components/ui'
import { useDesktop } from '../lib/useDesktop'
import { ProviderRaccolta } from '../lib/raccolta'
import { OsservaClasse } from '../components/osservatori/Osservatori'
import { InvitoNotifiche } from '../components/InvitoNotifiche'
import { PannelloDaFare, PannelloMie, Riepilogo } from '../components/osservatori/Pannelli'
import { CalendarioInterrogazioni } from '../components/osservatori/CalendarioInterrogazioni'

/** classes/{classId}/members/{uid} → classId */
function classIdDa(percorso: string): string {
  return percorso.split('/')[1] ?? ''
}

/** Sigla della classe per il quadratino (es. "4ªB Informatica" → "4ªB"), se è corta. */
function siglaClasse(nome: string): string | null {
  const prima = nome.trim().split(/\s+/)[0] ?? ''
  return prima.length > 0 && prima.length <= 4 ? prima : null
}

/** Saluto secondo l'ora del giorno. */
function saluto(ora: Date): string {
  const h = ora.getHours()
  return h < 13 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'
}

export default function Classi() {
  const profilo = useProfilo()
  const iscrizioni = useQuery<Membro>(db && queryMieIscrizioni(db, profilo.uid), `iscrizioni/${profilo.uid}`)
  const nessuna = iscrizioni.dati?.length === 0
  const desktop = useDesktop()
  const conClassi = !!iscrizioni.dati && iscrizioni.dati.length > 0
  const classi = <ElencoClassi iscrizioni={iscrizioni} nessuna={nessuna} />

  return (
    <ProviderRaccolta>
      {iscrizioni.dati?.map((m) => (
        <OsservaClasse key={m.percorso} classId={classIdDa(m.percorso)} membro={m} />
      ))}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {saluto(new Date())}, {profilo.nome.split(' ')[0]}
        </h1>
        <p className="mt-0.5 text-slate-600 dark:text-slate-400">
          {profilo.tipo === 'docente'
            ? nessuna
              ? 'Account docente: entra nella classe con il codice del capoclasse.'
              : 'Account docente: le liste delle classi in cui sei entrato.'
            : nessuna
              ? 'Per iniziare entra nella tua classe.'
              : 'Ecco a che punto sono le tue interrogazioni.'}
        </p>
      </div>

      {desktop && conClassi && <Riepilogo />}

      <Colonne
        desktop={desktop}
        principale={
          <>
            {conClassi && <PannelloMie caricamento={!iscrizioni.dati} />}
            {/* sul computer, senza classi, le due strade per iniziare stanno al centro */}
            {!conClassi && classi}
          </>
        }
        laterale={
          <>
            <PannelloDaFare />
            {conClassi && <InvitoNotifiche />}
            {conClassi && classi}
          </>
        }
        telefono={
          <>
            <PannelloDaFare />
            {conClassi && <PannelloMie caricamento={!iscrizioni.dati} />}
            {conClassi && <InvitoNotifiche />}
            {classi}
            {conClassi && <CalendarioInterrogazioni />}
          </>
        }
      />
      {desktop && conClassi && <CalendarioInterrogazioni />}
    </ProviderRaccolta>
  )
}

function ElencoClassi(p: { iscrizioni: ReturnType<typeof useQuery<Membro>>; nessuna: boolean }) {
  const iscrizioni = p.iscrizioni
  const nessuna = p.nessuna
  return (
    <>
      {iscrizioni.errore ? (
        <Riquadro tono="errore">{messaggioErrore(iscrizioni.errore)}</Riquadro>
      ) : !iscrizioni.dati ? (
        <Caricamento />
      ) : nessuna ? (
        <PrimoAccesso />
      ) : (
        <Scheda titolo="Le tue classi" icona={School}>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {iscrizioni.dati.map((m) => (
              <RigaClasse key={m.percorso} classId={classIdDa(m.percorso)} membro={m} />
            ))}
          </ul>
          <AltraClasse />
        </Scheda>
      )}
    </>
  )
}

function RigaClasse({ classId, membro }: { classId: string; membro: Membro }) {
  const classe = useDocumento<Classe>(db && rifClasse(db, classId))
  const nome = classe.dati?.nome ?? '…'
  const sigla = siglaClasse(nome)
  return (
    <RigaLink
      to={`/classe/${classId}`}
      sinistra={<Pallino icona={sigla ? undefined : Users}>{sigla}</Pallino>}
      destra={
        membro.ruolo !== 'studente' && (
          <Badge colore={membro.ruolo === 'docente' ? 'viola' : 'blu'}>{ETICHETTA_RUOLO[membro.ruolo]}</Badge>
        )
      }
    >
      <span className="block truncate text-base font-semibold">{nome}</span>
    </RigaLink>
  )
}

/** Nessuna classe: le due strade (entrare con il codice o crearne una) bene in vista. */
function PrimoAccesso() {
  const profilo = useProfilo()
  return (
    <>
      <Scheda titolo="Entra nella tua classe" icona={KeyRound} sottotitolo="Non sei ancora in nessuna classe.">
        <FormUnisciti />
      </Scheda>
      {profilo.tipo === 'studente' && (
        <Scheda titolo="Sei il capoclasse?" icona={Plus} sottotitolo="Crea la classe e poi invita i compagni.">
          <FormCreaClasse />
        </Scheda>
      )}
    </>
  )
}

/** Sotto l'elenco delle classi: entrare o crearne un'altra, aprendo il modulo solo quando serve. */
function AltraClasse() {
  const profilo = useProfilo()
  const [aperto, setAperto] = useState<'unisciti' | 'crea' | null>(null)
  return (
    <div className="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <div className="flex flex-wrap gap-2">
        <Bottone
          variante={aperto === 'unisciti' ? 'primario' : 'tenue'}
          icona={KeyRound}
          onClick={() => setAperto(aperto === 'unisciti' ? null : 'unisciti')}
        >
          Entra con un codice
        </Bottone>
        {profilo.tipo === 'studente' && (
          <Bottone
            variante={aperto === 'crea' ? 'primario' : 'tenue'}
            icona={Plus}
            onClick={() => setAperto(aperto === 'crea' ? null : 'crea')}
          >
            Crea una classe
          </Bottone>
        )}
      </div>
      {aperto && <Modulo>{aperto === 'unisciti' ? <FormUnisciti autoFocus /> : <FormCreaClasse autoFocus />}</Modulo>}
    </div>
  )
}

function FormUnisciti({ autoFocus }: { autoFocus?: boolean }) {
  const navigate = useNavigate()
  const profilo = useProfilo()
  const [testo, setTesto] = useState('')
  const [errore, setErrore] = useState<string | null>(null)

  function invia(e: FormEvent) {
    e.preventDefault()
    const codice = codiceDaTesto(testo)
    if (!codice) {
      setErrore("Il codice è di 6 caratteri, ad esempio ABC-DEF. Puoi anche incollare il link d'invito.")
      return
    }
    navigate(`/unisciti/${codice}`)
  }

  return (
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
        autoFocus={autoFocus}
        aiuto={
          profilo.tipo === 'docente'
            ? "Chiedi il codice d'invito al capoclasse."
            : 'Lo fornisce il capoclasse, di solito su WhatsApp.'
        }
      />
      {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
      <Bottone type="submit" disabled={!testo.trim()}>
        Continua
      </Bottone>
    </form>
  )
}

function FormCreaClasse({ autoFocus }: { autoFocus?: boolean }) {
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
    <form onSubmit={invia} className="space-y-3">
      <Campo
        etichetta="Nome della classe"
        valore={nome}
        onChange={setNome}
        placeholder="Es. 4ªB Informatica"
        maxLength={60}
        autoFocus={autoFocus}
        aiuto="Chi crea la classe ne diventa il capoclasse: aggiunge materie e interrogazioni."
      />
      {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
      <Bottone type="submit" disabled={inCorso || !nome.trim()}>
        {inCorso ? 'Creazione…' : 'Crea classe'}
      </Bottone>
    </form>
  )
}
