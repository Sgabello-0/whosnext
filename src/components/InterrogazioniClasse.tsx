import { Link } from 'react-router'
import { orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { rifInterrogazioni, rifMaterie } from '../lib/configurazione'
import { messaggioErrore } from '../lib/errori'
import { formattaScadenza } from '../lib/formatoDate'
import { useQuery, type ConId } from '../lib/hooks'
import type { Interrogazione, Materia } from '../lib/tipi'
import { BadgeStato } from './BadgeStato'
import { Caricamento, LinkBottone, Riquadro, Scheda } from './ui'

/** Elenco delle materie della classe con le loro interrogazioni. */
export function InterrogazioniClasse({ classId, staff }: { classId: string; staff: boolean }) {
  const materie = useQuery<Materia>(db && rifMaterie(db, classId), `materie/${classId}`)
  const elenco = [...(materie.dati ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))

  return (
    <Scheda
      titolo="Interrogazioni"
      azioni={staff ? <LinkBottone to={`/classe/${classId}/configura`}>Materie e calendario</LinkBottone> : undefined}
    >
      {materie.errore ? (
        <Riquadro tono="errore">{messaggioErrore(materie.errore)}</Riquadro>
      ) : !materie.dati ? (
        <Caricamento />
      ) : elenco.length === 0 ? (
        <p className="text-sm text-slate-500">
          {staff
            ? 'Nessuna materia. Inizia da "Materie e calendario": aggiungi le materie e i giorni di lezione.'
            : 'Il capoclasse non ha ancora aggiunto materie.'}
        </p>
      ) : (
        <ul className="space-y-4">
          {elenco.map((m) => (
            <MateriaConInterrogazioni key={m.id} classId={classId} materia={m} />
          ))}
        </ul>
      )}
    </Scheda>
  )
}

function MateriaConInterrogazioni({ classId, materia }: { classId: string; materia: ConId<Materia> }) {
  const interrogazioni = useQuery<Interrogazione>(
    db && query(rifInterrogazioni(db, classId, materia.id), orderBy('creato', 'desc')),
    `interrogazioni/${classId}/${materia.id}`,
  )
  const attive = (interrogazioni.dati ?? []).filter((i) => i.stato !== 'conclusa')

  return (
    <li>
      <Link to={`/classe/${classId}/materia/${materia.id}`} className="font-semibold hover:underline">
        {materia.nome}
      </Link>
      {interrogazioni.dati && attive.length === 0 && <p className="text-sm text-slate-500">Nessuna interrogazione in corso.</p>}
      {attive.length > 0 && (
        <ul className="mt-1 divide-y divide-slate-200 dark:divide-slate-800">
          {attive.map((i) => (
            <li key={i.id}>
              <Link
                to={`/classe/${classId}/materia/${materia.id}/interrogazione/${i.id}`}
                className="-mx-2 flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="min-w-0">
                  <span className="block">{i.nome}</span>
                  {i.stato === 'raccolta' && (
                    <span className="block text-xs text-slate-500">
                      Preferenze entro {formattaScadenza(i.scadenzaPreferenze.toDate())}
                    </span>
                  )}
                </span>
                <BadgeStato stato={i.stato} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
