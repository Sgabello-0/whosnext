import { useEffect, useState, type FormEvent } from 'react'
import { getDoc } from 'firebase/firestore'
import { ArrowLeftRight, Bell, CircleCheck, ExternalLink, LogOut, MessageSquareText, MonitorSmartphone, Moon, Palette, Send, ShieldCheck, Smartphone, Sparkles, Sun, UserRound } from 'lucide-react'
import { useAuth, useProfilo } from '../lib/auth'
import { db } from '../lib/firebase'
import { mostraMioDSA, queryMieIscrizioni, rifDSAMembro, rifUtente } from '../lib/classi'
import { feedbackAttivo, inviaFeedback, MAX_FEEDBACK } from '../lib/feedback'
import { messaggioErrore } from '../lib/errori'
import { useDocumento, useQuery } from '../lib/hooks'
import { tipoTelefono, useInstallazione } from '../lib/installazione'
import { impostaRifiutaScambi } from '../lib/scambi'
import { serverAttivo } from '../lib/avvisaServer'
import { attivaPush, disattivaPush, statoPush, type StatoPush } from '../lib/push'
import { impostaTema, useTema, type Tema } from '../lib/tema'
import type { ImpostazioniUtente, Membro } from '../lib/tipi'
import { useAvvisi } from '../components/Avvisi'
import { IstruzioniInstallazione, Vantaggi } from '../components/InstallaApp'
import { Avatar, Badge, Bottone, CLASSE_INPUT, IntestazionePagina, Scheda } from '../components/ui'
import { CREDITI } from '../lib/crediti'

const PRIVACY = 'https://github.com/Sgabello-0/whosnext/blob/main/PRIVACY.md'

export default function Impostazioni() {
  const profilo = useProfilo()
  const { esci } = useAuth()

  return (
    <>
      <IntestazionePagina indietro={{ to: '/', testo: 'Home' }} titolo="Impostazioni" />

      <Scheda titolo="Account" icona={UserRound}>
        <div className="flex items-center gap-3">
          <Avatar nome={profilo.nome} foto={profilo.foto} grande />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <span className="truncate">{profilo.nome}</span>
              <Badge colore={profilo.tipo === 'docente' ? 'viola' : 'blu'}>{profilo.tipo === 'docente' ? 'Docente' : 'Studente'}</Badge>
            </p>
            <p className="truncate text-sm text-slate-600 dark:text-slate-400">{profilo.email}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Nome e foto sono quelli del tuo account Google della scuola.</p>
        <div className="mt-4">
          <Bottone variante="secondario" icona={LogOut} onClick={esci}>
            Esci dall'account
          </Bottone>
        </div>
      </Scheda>

      {/* finché il server delle notifiche non è collegato, gli interruttori non servirebbero a niente */}
      {profilo.tipo === 'studente' && serverAttivo && <ImpostazioniNotifiche />}
      {profilo.tipo === 'studente' && <ImpostazioneScambi />}
      {profilo.tipo === 'studente' && <ImpostazioneDSA />}
      <ImpostazioneTema />
      <AppSulTelefono />
      {feedbackAttivo && <Feedback />}

      <Scheda titolo="Privacy" icona={ShieldCheck}>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          WhosNext usa solo nome, email e foto del tuo account della scuola. I compagni vedono il tuo nome e la tua posizione nelle
          liste; il badge DSA/BES lo vedono capoclasse e vice e, se lo lasci visibile, i compagni.
        </p>
        <a
          href={PRIVACY}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accento hover:underline dark:text-blue-300"
        >
          Leggi l'informativa completa
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      </Scheda>

      <p className="pt-2 text-center text-xs text-slate-600 dark:text-slate-400">WhosNext · {CREDITI}</p>
    </>
  )
}

/** Interruttore con titolo e spiegazione. */
function Interruttore(p: {
  titolo: string
  testo: string
  icona: typeof Bell
  acceso: boolean
  disattivo?: boolean
  onCambia: (v: boolean) => void
}) {
  const Icona = p.icona
  return (
    <label className={`flex items-start gap-3 ${p.disattivo ? 'opacity-70' : 'cursor-pointer'}`}>
      <Icona aria-hidden className="mt-0.5 size-4.5 shrink-0 text-slate-600 dark:text-slate-400" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{p.titolo}</span>
        <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">{p.testo}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={p.acceso}
        disabled={p.disattivo}
        onChange={(e) => p.onCambia(e.target.checked)}
        className="mt-1 size-5 shrink-0 accent-accento"
      />
    </label>
  )
}

const TESTO_PUSH: Record<StatoPush, string> = {
  attive: 'Attive su questo dispositivo.',
  spente: 'Un avviso sul telefono anche quando il sito è chiuso.',
  negate: 'Notifiche bloccate: riattivale dalle impostazioni del browser (il lucchetto accanto all\'indirizzo) e riprova.',
  'non-supportate': '',
}

/** Push su questo dispositivo: solo per le cose importanti. (Le email per ora no: dai domini esterni non arrivano agli indirizzi della scuola.) */
function ImpostazioniNotifiche() {
  const profilo = useProfilo()
  const avvisi = useAvvisi()
  const [push, setPush] = useState<StatoPush>(() => statoPush())
  const [inCorso, setInCorso] = useState(false)
  const iPhone = tipoTelefono() === 'iphone'

  async function cambiaPush(attiva: boolean) {
    setInCorso(true)
    try {
      if (attiva) {
        const nuovo = await attivaPush(profilo.uid)
        setPush(nuovo)
        if (nuovo === 'attive') avvisi.mostra('Notifiche attive su questo dispositivo')
      } else {
        await disattivaPush(profilo.uid)
        setPush('spente')
        avvisi.mostra('Notifiche spente su questo dispositivo')
      }
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <Scheda titolo="Notifiche" icona={Bell} sottotitolo="Solo per le cose importanti, niente di più.">
      <div className="space-y-5">
        {push === 'non-supportate' ? (
          <p className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-400">
            <Bell aria-hidden className="mt-0.5 size-4.5 shrink-0" />
            {iPhone
              ? "Su iPhone le notifiche arrivano solo con l'app installata: aggiungila alla schermata Home (qui sotto) e aprila da lì."
              : 'Su questo browser le notifiche non sono disponibili.'}
          </p>
        ) : (
          <Interruttore
            titolo="Notifiche sul telefono"
            testo={TESTO_PUSH[push]}
            icona={Bell}
            acceso={push === 'attive'}
            disattivo={inCorso || push === 'negate'}
            onCambia={cambiaPush}
          />
        )}
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
          <p className="mb-1.5 font-medium text-slate-700 dark:text-slate-300">Ricevi una notifica solo quando:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>c'è una nuova interrogazione: scegli il posto</li>
            <li>la lista è generata, con la tua posizione</li>
            <li>domani sei interrogato (la sera prima)</li>
            <li>un compagno ti richiede uno scambio</li>
          </ul>
        </div>
      </div>
    </Scheda>
  )
}

/** "Rifiuta in automatico gli scambi": vale per tutte le classi, anche quelle in cui si entrerà. */
function ImpostazioneScambi() {
  const profilo = useProfilo()
  const avvisi = useAvvisi()
  const utente = useDocumento<{ impostazioni?: Partial<ImpostazioniUtente> }>(db && rifUtente(db, profilo.uid))
  const iscrizioni = useQuery<Membro>(db && queryMieIscrizioni(db, profilo.uid), `iscrizioni/${profilo.uid}`)
  const salvato = utente.dati?.impostazioni?.autoRifiutaScambi === true
  // L'interruttore si sposta subito; torna com'era se il salvataggio non riesce
  const [valore, setValore] = useState(salvato)
  const [ultimo, setUltimo] = useState(salvato)
  if (salvato !== ultimo) {
    setUltimo(salvato)
    setValore(salvato)
  }
  const [inCorso, setInCorso] = useState(false)

  async function cambia(rifiuta: boolean) {
    if (!db || !iscrizioni.dati) return
    const d = db
    const classi = iscrizioni.dati.filter((m) => m.ruolo !== 'docente').map((m) => m.percorso.split('/')[1]!)
    setValore(rifiuta)
    setInCorso(true)
    try {
      await impostaRifiutaScambi(d, classi, profilo.uid, rifiuta)
      avvisi.mostra(rifiuta ? 'Da ora rifiuti in automatico le richieste di scambio' : 'Da ora ricevi le richieste di scambio', {
        annulla: () => impostaRifiutaScambi(d, classi, profilo.uid, !rifiuta),
      })
    } catch (e) {
      setValore(!rifiuta)
      avvisi.errore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <Scheda titolo="Scambi" icona={ArrowLeftRight}>
      <label className="flex cursor-pointer items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Rifiuta in automatico gli scambi</span>
          <span className="mt-0.5 block text-sm text-slate-600 dark:text-slate-400">
            {valore
              ? 'Nessuno può chiederti di scambiare il posto, in nessuna delle tue classi.'
              : 'I compagni possono chiederti di scambiare il posto nelle liste: decidi tu se accettare.'}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={valore}
          disabled={inCorso || !iscrizioni.dati || utente.dati === undefined}
          onChange={(e) => cambia(e.target.checked)}
          className="mt-1 size-5 shrink-0 accent-accento"
        />
      </label>
    </Scheda>
  )
}

/**
 * Badge DSA/BES: lo studente decide se mostrarlo ai compagni (in tutte le classi in cui ce l'ha).
 * Capoclasse e vice lo vedono sempre. Compare solo a chi ha il badge.
 */
function ImpostazioneDSA() {
  const profilo = useProfilo()
  const avvisi = useAvvisi()
  const iscrizioni = useQuery<Membro>(db && queryMieIscrizioni(db, profilo.uid), `iscrizioni/${profilo.uid}`)
  // classId → visibile, solo per le classi in cui ho il badge
  const [badge, setBadge] = useState<Map<string, boolean> | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const classi = (iscrizioni.dati ?? []).filter((m) => m.ruolo !== 'docente').map((m) => m.percorso.split('/')[1]!)
  const chiave = classi.join()

  useEffect(() => {
    if (!db || !iscrizioni.dati) return
    const d = db
    let attivo = true
    Promise.all(chiave.split(',').filter(Boolean).map(async (c) => [c, await getDoc(rifDSAMembro(d, c, profilo.uid))] as const))
      .then((risultati) => {
        if (!attivo) return
        setBadge(new Map(risultati.filter(([, s]) => s.exists()).map(([c, s]) => [c, s.data()?.visibile === true])))
      })
      .catch(() => attivo && setBadge(new Map()))
    return () => {
      attivo = false
    }
  }, [chiave, iscrizioni.dati, profilo.uid])

  if (!badge || badge.size === 0) return null
  const visibile = [...badge.values()].every(Boolean)

  async function cambia(mostra: boolean) {
    if (!db || !badge) return
    const d = db
    const conBadge = [...badge.keys()]
    const prima = badge
    // l'interruttore si sposta subito; torna com'era se il salvataggio non riesce
    setBadge(new Map(conBadge.map((c) => [c, mostra])))
    setInCorso(true)
    try {
      await mostraMioDSA(d, conBadge, profilo.uid, mostra)
      avvisi.mostra(mostra ? 'Il badge DSA/BES ora è visibile ai compagni' : 'Il badge DSA/BES ora è nascosto ai compagni', {
        annulla: async () => {
          await mostraMioDSA(d, conBadge, profilo.uid, !mostra)
          setBadge(new Map(conBadge.map((c) => [c, !mostra])))
        },
      })
    } catch (e) {
      setBadge(prima)
      avvisi.errore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <Scheda titolo="Badge DSA/BES" icona={Sparkles}>
      <Interruttore
        titolo="Mostra il badge ai compagni"
        testo={
          visibile
            ? 'I compagni vedono il badge accanto al tuo nome. Capoclasse e vice lo vedono sempre.'
            : 'Il badge lo vedono solo capoclasse e vice. Nella lista compari comunque nel giorno che hai scelto.'
        }
        icona={Sparkles}
        acceso={visibile}
        disattivo={inCorso}
        onCambia={cambia}
      />
    </Scheda>
  )
}

/** Un messaggio per chi ha creato WhosNext: problemi, idee, suggerimenti. */
function Feedback() {
  const avvisi = useAvvisi()
  const [testo, setTesto] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function invia(e: FormEvent) {
    e.preventDefault()
    setInCorso(true)
    setErrore(null)
    try {
      await inviaFeedback(testo)
      setTesto('')
      avvisi.mostra('Feedback inviato: grazie!')
    } catch (err) {
      setErrore(messaggioErrore(err))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <Scheda titolo="Feedback" icona={MessageSquareText} sottotitolo="Un problema, un'idea, qualcosa da migliorare? Scrivilo qui.">
      <form onSubmit={invia} className="space-y-3">
        <label className="block text-sm">
          <span className="sr-only">Il tuo feedback</span>
          <textarea
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            maxLength={MAX_FEEDBACK}
            rows={4}
            placeholder="Scrivi qui il tuo messaggio…"
            className={`${CLASSE_INPUT} resize-y`}
          />
        </label>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-slate-600 dark:text-slate-400">
            Insieme al messaggio arrivano il tuo nome e la tua email. {testo.length}/{MAX_FEEDBACK}
          </span>
          <Bottone type="submit" icona={Send} disabled={inCorso || testo.trim().length < 3}>
            {inCorso ? 'Invio…' : 'Invia'}
          </Bottone>
        </div>
        {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
      </form>
    </Scheda>
  )
}

const TEMI: { id: Tema; etichetta: string; icona: typeof Sun }[] = [
  { id: 'automatico', etichetta: 'Automatico', icona: MonitorSmartphone },
  { id: 'chiaro', etichetta: 'Chiaro', icona: Sun },
  { id: 'scuro', etichetta: 'Scuro', icona: Moon },
]

function ImpostazioneTema() {
  const tema = useTema()
  return (
    <Scheda titolo="Aspetto" icona={Palette} sottotitolo="Vale solo su questo dispositivo. Automatico: come il telefono.">
      <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2">
        {TEMI.map(({ id, etichetta, icona: Icona }) => {
          const attivo = tema === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={attivo}
              onClick={() => impostaTema(id)}
              className={`flex flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-3 text-sm font-semibold transition ${
                attivo
                  ? 'border-accento bg-accento-chiaro text-accento dark:bg-blue-950 dark:text-blue-200'
                  : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
              }`}
            >
              <Icona aria-hidden className="size-5" />
              {etichetta}
            </button>
          )
        })}
      </div>
    </Scheda>
  )
}

function AppSulTelefono() {
  const { installata } = useInstallazione()
  return (
    <Scheda titolo="App sul telefono" icona={Smartphone}>
      {installata ? (
        <p className="flex items-center gap-2 text-sm">
          <CircleCheck aria-hidden className="size-4.5 text-emerald-600" />
          Stai usando l'app installata.
        </p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-sm">Mettila nella schermata Home: si apre come un'app, anche senza connessione.</p>
            <Vantaggi />
          </div>
          <IstruzioniInstallazione telefono={tipoTelefono()} />
        </div>
      )}
    </Scheda>
  )
}
