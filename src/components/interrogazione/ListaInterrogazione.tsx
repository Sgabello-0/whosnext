import { db } from '../../lib/firebase'
import { oggiISO, type Calendario } from '../../lib/calendar'
import { rifLista, rifRapporto } from '../../lib/configurazione'
import { messaggioErrore } from '../../lib/errori'
import { stimaInterrogazione, testoStima } from '../../lib/estimate'
import { useDocumento } from '../../lib/hooks'
import type { DocLista, DocRapporto, Interrogazione, Membro } from '../../lib/tipi'
import { Avatar, Badge, Caricamento, Riquadro, Scheda } from '../ui'

type Props = {
  classId: string
  subjectId: string
  interrogazioneId: string
  interrogazione: Interrogazione
  membri: Membro[]
  mioUid: string
  cal: Calendario
  staff: boolean
}

/** La lista generata, con la data stimata per ognuno. */
export function ListaInterrogazione(p: Props) {
  const lista = useDocumento<DocLista>(db && rifLista(db, p.classId, p.subjectId, p.interrogazioneId))
  if (lista.errore) return <Riquadro tono="errore">{messaggioErrore(lista.errore)}</Riquadro>
  if (lista.dati === undefined) return <Caricamento />
  if (lista.dati === null) return <Riquadro tono="avviso">La lista non è ancora disponibile.</Riquadro>

  const { ordine, interrogati } = lista.dati
  const perUid = new Map(p.membri.map((m) => [m.uid, m]))
  const oggi = oggiISO()
  // k = posizione tra i non ancora interrogati
  const nonInterrogati = ordine.filter((u) => !interrogati[u])
  const stima = (uid: string) =>
    testoStima(
      stimaInterrogazione({
        k: nonInterrogati.indexOf(uid),
        perLezione: p.interrogazione.perLezione,
        giorni: p.interrogazione.giorni,
        subjectId: p.subjectId,
        cal: p.cal,
        da: oggi,
      }),
    )
  const miaPosizione = ordine.indexOf(p.mioUid)

  return (
    <>
      {miaPosizione >= 0 && (
        <Riquadro tono="info" titolo={`Sei il n° ${miaPosizione + 1} di ${ordine.length}`}>
          {interrogati[p.mioUid] ? 'Sei già stato interrogato.' : stima(p.mioUid)}
        </Riquadro>
      )}

      <Scheda titolo="Lista">
        <ol className="divide-y divide-slate-200 dark:divide-slate-800" aria-label="Ordine delle interrogazioni">
          {ordine.map((uid, i) => {
            const m = perUid.get(uid)
            const io = uid === p.mioUid
            const fatto = !!interrogati[uid]
            return (
              <li
                key={uid}
                className={`flex items-center gap-3 py-2.5 ${io ? '-mx-2 rounded-lg bg-accento-chiaro px-2 dark:bg-blue-950/60' : ''}`}
              >
                <span className="w-7 shrink-0 text-right font-mono text-sm text-slate-500">{i + 1}</span>
                <Avatar nome={m?.nome ?? '?'} foto={m?.foto ?? null} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className={`truncate font-medium ${fatto ? 'text-slate-400 line-through' : ''}`}>
                      {m?.nome ?? 'Ex membro'}
                    </span>
                    {io && <Badge>tu</Badge>}
                    {fatto && <Badge colore="verde">interrogato</Badge>}
                  </p>
                  {!fatto && <p className="text-xs text-slate-500">{stima(uid)}</p>}
                </div>
              </li>
            )
          })}
        </ol>
      </Scheda>

      {p.staff && <RapportoSoddisfazione {...p} />}
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
    <Scheda titolo="Rapporto (visibile a capoclasse e vice)">
      <ul className="space-y-1 text-sm">
        <li>
          Hanno risposto <strong>{r.risposte}</strong> su {r.totale}
          {r.indifferenti > 0 && `, di cui ${r.indifferenti} "non mi interessa"`}.
        </li>
        {riga('Inizio ottenuto', r.inizio.ottenute, r.inizio.richieste)}
        {riga('Metà ottenuta', r.meta.ottenute, r.meta.richieste)}
        {riga('Fine ottenuta', r.fine.ottenute, r.fine.richieste)}
        {riga('DSA/BES alla posizione esatta', r.dsa.esatte, r.dsa.richieste)}
        <li className="text-xs text-slate-500">Seme del sorteggio: {r.seme}</li>
      </ul>
    </Scheda>
  )
}
