import { useState } from 'react'
import { ArrowLeftRight, Bell, CircleCheck, Mail, ExternalLink, LogOut, MonitorSmartphone, Moon, Palette, ShieldCheck, Smartphone, Sun, UserRound } from 'lucide-react'
import { useAuth, useProfilo } from '../lib/auth'
import { db } from '../lib/firebase'
import { queryMieIscrizioni, rifUtente } from '../lib/classi'
import { messaggioErrore } from '../lib/errori'
import { useDocumento, useQuery } from '../lib/hooks'
import { tipoTelefono, useInstallazione } from '../lib/installazione'
import { impostaRifiutaScambi } from '../lib/scambi'
import { serverAttivo } from '../lib/avvisaServer'
import { attivaPush, disattivaPush, impostaEmail, statoPush, type StatoPush } from '../lib/push'
import { impostaTema, useTema, type Tema } from '../lib/tema'
import type { ImpostazioniUtente, Membro } from '../lib/tipi'
import { useAvvisi } from '../components/Avvisi'
import { IstruzioniInstallazione, Vantaggi } from '../components/InstallaApp'
import { Avatar, Badge, Bottone, IntestazionePagina, Scheda } from '../components/ui'
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
            <p className="truncate text-sm text-slate-500">{profilo.email}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-500">Nome e foto sono quelli del tuo account Google della scuola.</p>
        <div className="mt-4">
          <Bottone variante="secondario" icona={LogOut} onClick={esci}>
            Esci dall'account
          </Bottone>
        </div>
      </Scheda>

      {/* finché il server delle notifiche non è collegato, gli interruttori non servirebbero a niente */}
      {profilo.tipo === 'studente' && serverAttivo && <ImpostazioniNotifiche />}
      {profilo.tipo === 'studente' && <ImpostazioneScambi />}
      <ImpostazioneTema />
      <AppSulTelefono />

      <Scheda titolo="Privacy" icona={ShieldCheck}>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          WhosNext usa solo nome, email e foto del tuo account della scuola. I compagni vedono il tuo nome e la tua posizione nelle
          liste; il badge DSA/BES lo vedono solo capoclasse e vice.
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

      <p className="pt-2 text-center text-xs text-slate-400 dark:text-slate-500">WhosNext · {CREDITI}</p>
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
      <Icona aria-hidden className="mt-0.5 size-4.5 shrink-0 text-slate-500" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{p.titolo}</span>
        <span className="mt-0.5 block text-sm text-slate-500">{p.testo}</span>
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
  negate: 'Le hai bloccate: riattivale dalle impostazioni del browser (il lucchetto accanto all\'indirizzo), poi riprova.',
  'non-supportate': '',
}

/** Push (su questo dispositivo) ed email: solo per le cose importanti. */
function ImpostazioniNotifiche() {
  const profilo = useProfilo()
  const avvisi = useAvvisi()
  const utente = useDocumento<{ impostazioni?: Partial<ImpostazioniUtente> }>(db && rifUtente(db, profilo.uid))
  const [push, setPush] = useState<StatoPush>(() => statoPush())
  const [inCorso, setInCorso] = useState(false)
  const emailAttive = utente.dati?.impostazioni?.notificheEmail !== false
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

  async function cambiaEmail(attive: boolean) {
    try {
      await impostaEmail(profilo.uid, attive)
      avvisi.mostra(attive ? 'Email attive' : 'Email spente')
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
    }
  }

  return (
    <Scheda titolo="Notifiche" icona={Bell} sottotitolo="Solo per le cose importanti, niente di più.">
      <div className="space-y-5">
        {push === 'non-supportate' ? (
          <p className="flex items-start gap-3 text-sm text-slate-500">
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
        <Interruttore
          titolo="Email"
          testo="Solo quando la lista è pronta e quando qualcuno ti chiede uno scambio, all'indirizzo della scuola."
          icona={Mail}
          acceso={emailAttive}
          disattivo={utente.dati === undefined}
          onCambia={cambiaEmail}
        />
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950/50 dark:text-slate-400">
          <p className="mb-1.5 font-medium text-slate-700 dark:text-slate-300">Ti avvisiamo solo quando:</p>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>la lista è pronta, con la tua posizione</li>
            <li>qualcuno ti chiede uno scambio, o risponde al tuo</li>
            <li>la scadenza per scegliere è vicina e non hai ancora scelto</li>
            <li>la sera prima, se probabilmente tocca a te</li>
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
          <span className="mt-0.5 block text-sm text-slate-500">
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
