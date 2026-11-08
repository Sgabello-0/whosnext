import { avvisaServer, serverAttivo } from '../../lib/avvisaServer'
import { useState } from 'react'
import { formattaGiorno } from '../../lib/calendar'
import { db } from '../../lib/firebase'
import { impostaEsclusi, rifPreferenze } from '../../lib/configurazione'
import { messaggioErrore } from '../../lib/errori'
import type { Scelta } from '../../lib/generateList'
import { useQuery } from '../../lib/hooks'
import { confrontaCognomi } from '../../lib/membri'
import { generaEPubblicaLista } from '../../lib/preferenze'
import { ETICHETTA_SCELTA } from '../../lib/testiPreferenze'
import type { DocPreferenza, Membro } from '../../lib/tipi'
import { Avatar, Bottone, Caricamento, Riquadro, Scheda, Soffietto } from '../ui'
import { Inbox, Shuffle, UserMinus } from 'lucide-react'
import { Condividi } from '../Condividi'
import { linkAssoluto, messaggioPromemoria, percorsoInterrogazione } from '../../lib/messaggi'
import { useAvvisi } from '../Avvisi'
import { useConferma } from '../Conferma'

const ORDINE_SCELTE: Scelta[] = ['inizio', 'meta', 'fine', 'indifferente', 'data']

/** Per capoclasse e vice: chi ha risposto, cosa ha scelto, e il pulsante per generare la lista. */
export function PannelloPreferenze(p: {
  classId: string
  subjectId: string
  interrogazioneId: string
  mioUid: string
  studenti: Membro[]
  scaduta: boolean
  nomeInterrogazione: string
  nomeMateria: string
  scadenza: Date
  /** studenti esclusi (non entrano in lista) */
  esclusi: string[]
}) {
  const preferenze = useQuery<DocPreferenza>(
    db && rifPreferenze(db, p.classId, p.subjectId, p.interrogazioneId),
    `preferenze/${p.classId}/${p.subjectId}/${p.interrogazioneId}`,
  )
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()
  const conferma = useConferma()
  // le spunte si spostano subito; tornano come prima se il salvataggio non riesce
  const [elencoEsclusi, setElencoEsclusi] = useState(p.esclusi)
  const [apertoEsclusi] = useState(p.esclusi.length > 0)
  const chiaveEsclusi = p.esclusi.join('|')
  const [salvati, setSalvati] = useState(chiaveEsclusi)
  if (salvati !== chiaveEsclusi) {
    setSalvati(chiaveEsclusi)
    setElencoEsclusi(p.esclusi)
  }

  if (preferenze.errore) return <Riquadro tono="errore">{messaggioErrore(preferenze.errore)}</Riquadro>
  if (!preferenze.dati) return <Caricamento />

  const perUid = new Map(preferenze.dati.map((d) => [d.id, d]))
  const nome = (uid: string) => p.studenti.find((s) => s.uid === uid)?.nome ?? 'Ex membro'
  const esclusi = new Set(elencoEsclusi)
  // contano solo gli studenti in lista: le preferenze degli esclusi si ignorano
  const inLista = p.studenti.filter((s) => !esclusi.has(s.uid))
  const studentiUid = new Set(inLista.map((s) => s.uid))
  const risposte = preferenze.dati.filter((d) => studentiUid.has(d.id))
  const senzaRisposta = inLista.filter((s) => !perUid.has(s.uid))

  async function cambiaEsclusione(uid: string, escludi: boolean) {
    if (!db) return
    const d = db
    const prima = elencoEsclusi
    const dopo = escludi ? [...prima, uid] : prima.filter((u) => u !== uid)
    setElencoEsclusi(dopo)
    try {
      await impostaEsclusi(d, p.classId, p.subjectId, p.interrogazioneId, dopo)
      avvisi.mostra(escludi ? `${nome(uid)} escluso da questa interrogazione` : `${nome(uid)} di nuovo in lista`, {
        annulla: () => impostaEsclusi(d, p.classId, p.subjectId, p.interrogazioneId, prima),
      })
    } catch (e) {
      setElencoEsclusi(prima)
      avvisi.errore(messaggioErrore(e))
    }
  }

  async function genera() {
    if (!db) return
    const ok = await conferma({
      titolo: 'Generare la lista adesso?',
      testo: `Il sorteggio si fa una volta sola, tra ${inLista.length} ${inLista.length === 1 ? 'studente' : 'studenti'}${
        esclusi.size > 0 ? ` (${esclusi.size} ${esclusi.size === 1 ? 'escluso' : 'esclusi'})` : ''
      }. Dopo potrai comunque modificare la lista a mano.`,
      pulsante: 'Genera lista',
    })
    if (!ok) return
    setInCorso(true)
    setErrore(null)
    try {
      await generaEPubblicaLista(db, p, p.mioUid)
      avvisaServer('lista-pronta', { classId: p.classId, subjectId: p.subjectId, interrogazioneId: p.interrogazioneId })
      avvisi.mostra('Lista generata: ora la vedono tutti')
    } catch (e) {
      setErrore(messaggioErrore(e))
      setInCorso(false)
    }
  }

  return (
    <Scheda
      titolo={`Preferenze ricevute (${risposte.length}/${inLista.length})`}
      icona={Inbox}
      tono={p.scaduta ? 'avviso' : 'normale'}
    >
      <div className="space-y-4 text-sm">
        <ul className="space-y-2.5">
          {ORDINE_SCELTE.map((s) => {
            const chi = risposte.filter((d) => d.scelta === s)
            if (chi.length === 0) return null
            return (
              <li key={s}>
                <strong>{ETICHETTA_SCELTA[s]}</strong> ({chi.length}):{' '}
                {[...chi]
                  .sort((a, b) => confrontaCognomi(nome(a.id), nome(b.id)))
                  .map((d) => (s === 'data' && d.dataDSA ? `${nome(d.id)} (${formattaGiorno(d.dataDSA).toLowerCase()})` : nome(d.id)))
                  .join(', ')}
              </li>
            )
          })}
          {senzaRisposta.length > 0 && (
            <li className="text-slate-600 dark:text-slate-400">
              <strong>Non hanno risposto</strong> ({senzaRisposta.length}):{' '}
              {senzaRisposta.map((s) => s.nome).sort(confrontaCognomi).join(', ')}
            </li>
          )}
        </ul>

        <Soffietto
          titolo={esclusi.size > 0 ? `Escludi studenti (${esclusi.size} ${esclusi.size === 1 ? 'escluso' : 'esclusi'})` : 'Escludi studenti'}
          icona={UserMinus}
          aperto={apertoEsclusi}
        >
          <p className="mb-2 text-sm text-slate-600 dark:text-slate-400">
            Togli la spunta a chi non deve entrare in lista (ritirato, già valutato, assente a lungo…). Vale anche per la
            generazione automatica. Dopo la generazione potrai comunque rimetterlo.
          </p>
          <ul className="space-y-0.5" aria-label="Studenti in lista">
            {[...p.studenti]
              .sort((a, b) => confrontaCognomi(a.nome, b.nome))
              .map((s) => (
                <li key={s.uid}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                    <input
                      type="checkbox"
                      checked={!esclusi.has(s.uid)}
                      onChange={(e) => cambiaEsclusione(s.uid, !e.target.checked)}
                      className="size-5 accent-accento"
                    />
                    <Avatar nome={s.nome} foto={s.foto} />
                    <span className={`min-w-0 flex-1 truncate ${esclusi.has(s.uid) ? 'text-slate-500 line-through dark:text-slate-400' : ''}`}>
                      {s.nome}
                    </span>
                    {esclusi.has(s.uid) && <span className="text-xs text-slate-600 dark:text-slate-400">escluso</span>}
                  </label>
                </li>
              ))}
          </ul>
        </Soffietto>

        {p.scaduta ? (
          <div className="space-y-2">
            <p>
              Le preferenze sono chiuse: puoi generare la lista.
              {serverAttivo && ' Se non lo fai, si genera da sola entro un quarto d\'ora.'}
            </p>
            <Bottone onClick={genera} disabled={inCorso} icona={Shuffle}>
              {inCorso ? 'Generazione…' : 'Genera lista'}
            </Bottone>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-600 dark:text-slate-400">
              Potrai generare la lista dopo la scadenza. Se tutti hanno già risposto, puoi anticipare la scadenza da
              "Modifica".
            </p>
            <Condividi
              etichetta={senzaRisposta.length > 0 ? 'Promemoria per chi non ha scelto' : 'Messaggio per la classe'}
              titolo={`${p.nomeMateria} – ${p.nomeInterrogazione}`}
              testo={messaggioPromemoria({
                interrogazione: p.nomeInterrogazione,
                materia: p.nomeMateria,
                scadenza: p.scadenza,
                link: linkAssoluto(percorsoInterrogazione(p.classId, p.subjectId, p.interrogazioneId)),
                mancanti: senzaRisposta.length,
              })}
            />
          </div>
        )}
        {errore && <Riquadro tono="errore">{errore}</Riquadro>}
      </div>
    </Scheda>
  )
}
