import { useState } from 'react'
import { BellRing, X } from 'lucide-react'
import { useProfilo } from '../lib/auth'
import { messaggioErrore } from '../lib/errori'
import { attivaPush, statoPush } from '../lib/push'
import { serverAttivo } from '../lib/avvisaServer'
import { useAvvisi } from './Avvisi'
import { Bottone } from './ui'

const CHIAVE = 'invito-notifiche-rimandato'
const UN_MESE = 30 * 24 * 3_600_000

function rimandato(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(CHIAVE) ?? 0) < UN_MESE
  } catch {
    return false
  }
}

/** Nella pagina iniziale, una volta: "vuoi ricevere un avviso quando la lista è pubblicata?". Si chiude e non torna per un mese. */
export function InvitoNotifiche() {
  const profilo = useProfilo()
  const avvisi = useAvvisi()
  const [visibile, setVisibile] = useState(
    () => serverAttivo && profilo.tipo === 'studente' && statoPush() === 'spente' && !rimandato(),
  )
  const [inCorso, setInCorso] = useState(false)
  if (!visibile) return null

  function nonOra() {
    try {
      localStorage.setItem(CHIAVE, String(Date.now()))
    } catch {
      /* solo per questa visita */
    }
    setVisibile(false)
  }

  async function attiva() {
    setInCorso(true)
    try {
      const stato = await attivaPush(profilo.uid)
      if (stato === 'attive') avvisi.mostra('Notifiche attive: riceverai solo gli avvisi importanti')
      if (stato !== 'spente') setVisibile(false)
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <section
      aria-label="Attiva le notifiche"
      className="flex items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <span
        aria-hidden
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accento-chiaro text-accento dark:bg-blue-950 dark:text-blue-300"
      >
        <BellRing className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div>
          <p className="font-semibold">Vuoi ricevere un avviso quando la lista è pubblicata?</p>
          <p className="text-sm text-slate-500">Anche per le richieste di scambio e la sera prima dell'interrogazione prevista. Nient'altro.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Bottone variante="primario" disabled={inCorso} onClick={attiva}>
            Attiva le notifiche
          </Bottone>
          <Bottone variante="tenue" onClick={nonOra}>
            Non ora
          </Bottone>
        </div>
      </div>
      <button
        type="button"
        onClick={nonOra}
        aria-label="Chiudi"
        className="-mt-1 -mr-1 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <X aria-hidden className="size-4.5" />
      </button>
    </section>
  )
}
