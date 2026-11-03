import { useState } from 'react'
import { db } from '../../lib/firebase'
import { formattaGiorno, oggiISO, type Calendario } from '../../lib/calendar'
import { rifLista, rifRapporto } from '../../lib/configurazione'
import { messaggioErrore } from '../../lib/errori'
import { stimaInterrogazione, testoStima } from '../../lib/estimate'
import { segnaInterrogati, togliInterrogato } from '../../lib/gestioneLista'
import { useDocumento } from '../../lib/hooks'
import { nonInterrogati } from '../../lib/lista'
import type { DocLista, DocRapporto, Interrogazione, Membro } from '../../lib/tipi'
import { Avatar, Badge, Bottone, Caricamento, Riquadro, Scheda, Soffietto } from '../ui'
import { ArrowUpDown, ChartPie, Check, ListOrdered, PartyPopper, Undo2 } from 'lucide-react'
import { useAvvisi } from '../Avvisi'
import { RiordinaLista } from './RiordinaLista'
import { StoricoLista } from './StoricoLista'
import { Condividi } from '../Condividi'
import { linkAssoluto, percorsoInterrogazione, testoLista } from '../../lib/messaggi'
import { SegnaInterrogati } from './SegnaInterrogati'
import { Segnalazioni, SonoStatoInterrogato } from './Segnalazioni'

type Props = {
  classId: string
  subjectId: string
  interrogazioneId: string
  interrogazione: Interrogazione
  membri: Membro[]
  mioUid: string
  cal: Calendario
  /** capo e vice: vedono il rapporto */
  staff: boolean
  /** capo, vice e docenti con permesso: riordinano e segnano gli interrogati */
  puoModificare: boolean
  nomeMateria: string
}

/** La lista generata, con la data stimata per ognuno e gli strumenti per chi la gestisce. */
export function ListaInterrogazione(p: Props) {
  const lista = useDocumento<DocLista>(db && rifLista(db, p.classId, p.subjectId, p.interrogazioneId))
  const [riordino, setRiordino] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()

  if (lista.errore) return <Riquadro tono="errore">{messaggioErrore(lista.errore)}</Riquadro>
  if (lista.dati === undefined) return <Caricamento />
  if (lista.dati === null) return <Riquadro tono="avviso">La lista non è ancora disponibile.</Riquadro>

  const r = { classId: p.classId, subjectId: p.subjectId, interrogazioneId: p.interrogazioneId }
  const { ordine, interrogati } = lista.dati
  const perUid = new Map(p.membri.map((m) => [m.uid, m]))
  const oggi = oggiISO()
  // k = posizione tra i non ancora interrogati
  const mancanti = nonInterrogati(ordine, interrogati)
  const interrogatiOggi = Object.values(interrogati).filter((d) => d === oggi).length
  const stima = (uid: string) =>
    testoStima(
      stimaInterrogazione({
        k: mancanti.indexOf(uid),
        perLezione: p.interrogazione.perLezione,
        giorni: p.interrogazione.giorni,
        subjectId: p.subjectId,
        cal: p.cal,
        da: oggi,
        giaInterrogatiDa: interrogatiOggi,
      }),
    )
  const miaPosizione = ordine.indexOf(p.mioUid)

  async function annullaInterrogato(uid: string) {
    if (!db) return
    const d = db
    const data = interrogati[uid]!
    setErrore(null)
    try {
      await togliInterrogato(d, r, uid, p.mioUid)
      avvisi.mostra(`Tolto il segno a ${perUid.get(uid)?.nome ?? 'ex membro'}`, {
        annulla: () => segnaInterrogati(d, r, [uid], data, p.mioUid),
      })
    } catch (e) {
      setErrore(messaggioErrore(e))
    }
  }

  return (
    <>
      {miaPosizione >= 0 && (
        <section
          role="status"
          className={`flex gap-4 rounded-2xl p-4 shadow-sm sm:p-5 ${
            interrogati[p.mioUid]
              ? 'bg-emerald-600 text-white'
              : 'bg-gradient-to-br from-accento to-blue-700 text-white'
          }`}
        >
          <span
            aria-hidden
            className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15 text-3xl leading-none font-bold"
          >
            {interrogati[p.mioUid] ? <Check className="size-8" /> : miaPosizione + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-lg font-bold">{`Sei il n° ${miaPosizione + 1} di ${ordine.length}`}</p>
            {interrogati[p.mioUid] ? (
              <p className="text-emerald-50">
                Sei stato interrogato {formattaGiorno(interrogati[p.mioUid]!).toLowerCase()}.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-blue-50">{stima(p.mioUid)}</p>
                {/* chi modifica le liste si segna da solo nella scheda qui sotto */}
                {!p.puoModificare && <SonoStatoInterrogato r={r} uid={p.mioUid} />}
              </div>
            )}
          </div>
        </section>
      )}

      {p.interrogazione.stato === 'conclusa' && (
        <Riquadro tono="ok" titolo="Interrogazione conclusa" icona={PartyPopper}>
          Sono stati interrogati tutti.
        </Riquadro>
      )}

      {p.puoModificare && !riordino && (
        <>
          <Segnalazioni r={r} membri={perUid} mioUid={p.mioUid} />
          <SegnaInterrogati
            key={`${mancanti.slice(0, 10).join()}|${p.interrogazione.perLezione}`}
            r={r}
            interrogazione={p.interrogazione}
            ordine={ordine}
            interrogati={interrogati}
            membri={perUid}
            cal={p.cal}
            mioUid={p.mioUid}
          />
        </>
      )}

      {riordino ? (
        <RiordinaLista
          r={r}
          ordine={ordine}
          interrogati={interrogati}
          membri={perUid}
          mioUid={p.mioUid}
          onFine={() => setRiordino(false)}
        />
      ) : (
        <Scheda
          titolo="Lista"
          icona={ListOrdered}
          sottotitolo={`${ordine.length - mancanti.length} su ${ordine.length} interrogati`}
          azioni={
            p.puoModificare ? (
              <Bottone variante="piccolo" icona={ArrowUpDown} onClick={() => setRiordino(true)}>
                Riordina
              </Bottone>
            ) : undefined
          }
        >
          {errore && (
            <div className="mb-3">
              <Riquadro tono="errore">{errore}</Riquadro>
            </div>
          )}
          <ol className="divide-y divide-slate-100 dark:divide-slate-800" aria-label="Ordine delle interrogazioni">
            {ordine.map((uid, i) => {
              const m = perUid.get(uid)
              const io = uid === p.mioUid
              const quando = interrogati[uid]
              return (
                <li
                  key={uid}
                  className={`flex items-center gap-3 py-2.5 ${io ? '-mx-2 rounded-xl bg-accento-chiaro px-2 dark:bg-blue-950/60' : ''}`}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      quando
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {quando ? <Check aria-label="interrogato" className="size-4" /> : i + 1}
                  </span>
                  <Avatar nome={m?.nome ?? '?'} foto={m?.foto ?? null} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className={`truncate font-medium ${quando ? 'text-slate-400 line-through' : ''}`}>
                        {m?.nome ?? 'Ex membro'}
                      </span>
                      {io && <Badge>tu</Badge>}
                      {quando && <Badge colore="verde">interrogato</Badge>}
                    </p>
                    <p className="text-xs text-slate-500">{quando ? formattaGiorno(quando) : stima(uid)}</p>
                  </div>
                  {quando && p.puoModificare && (
                    <Bottone
                      variante="piccolo"
                      icona={Undo2}
                      aria-label={`Annulla interrogato ${m?.nome ?? ''}`}
                      onClick={() => annullaInterrogato(uid)}
                    >
                      Annulla
                    </Bottone>
                  )}
                </li>
              )
            })}
          </ol>
          <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <Condividi
              etichetta="Condividi la lista"
              titolo={`${p.nomeMateria} – ${p.interrogazione.nome}`}
              testo={testoLista({
                materia: p.nomeMateria,
                interrogazione: p.interrogazione.nome,
                link: linkAssoluto(percorsoInterrogazione(p.classId, p.subjectId, p.interrogazioneId)),
                righe: ordine.map((uid) => ({
                  nome: perUid.get(uid)?.nome ?? 'Ex membro',
                  interrogato: !!interrogati[uid],
                  nota: interrogati[uid] ? `interrogato ${formattaGiorno(interrogati[uid]!)}` : stima(uid),
                })),
              })}
            />
          </div>
        </Scheda>
      )}

      {p.staff && <RapportoSoddisfazione {...p} />}
      <StoricoLista classId={p.classId} subjectId={p.subjectId} interrogazioneId={p.interrogazioneId} membri={perUid} />
    </>
  )
}

function RapportoSoddisfazione(p: Props) {
  const rapporto = useDocumento<DocRapporto>(db && rifRapporto(db, p.classId, p.subjectId, p.interrogazioneId))
  const r = rapporto.dati
  if (!r) return null
  const riga = (etichetta: string, ottenute: number, richieste: number) =>
    richieste > 0 && (
      <li>
        {etichetta}: <strong>{ottenute}</strong> su {richieste}
      </li>
    )
  return (
    <Soffietto titolo="Rapporto (visibile a capoclasse e vice)" icona={ChartPie}>
      <ul className="space-y-1 text-sm">
        <li>
          Hanno risposto <strong>{r.risposte}</strong> su {r.totale}
          {r.indifferenti > 0 && `, di cui ${r.indifferenti} "non mi interessa"`}.
        </li>
        {riga('Inizio ottenuto', r.inizio.ottenute, r.inizio.richieste)}
        {riga('Metà ottenuta', r.meta.ottenute, r.meta.richieste)}
        {riga('Fine ottenuta', r.fine.ottenute, r.fine.richieste)}
        {riga('DSA/BES alla posizione esatta', r.dsa.esatte, r.dsa.richieste)}
        <li className="text-xs text-slate-500">
          Seme del sorteggio: {r.seme}. Il rapporto si riferisce alla lista appena generata, prima di eventuali
          riordini.
        </li>
      </ul>
    </Soffietto>
  )
}
