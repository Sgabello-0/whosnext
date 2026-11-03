import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { creaInterrogazione, rifInterrogazioni, rifMaterie } from '../lib/configurazione'
import { percorsoInterrogazione } from '../lib/messaggi'
import { messaggioErrore } from '../lib/errori'
import { formattaScadenza } from '../lib/formatoDate'
import { useQuery, type ConId } from '../lib/hooks'
import type { Interrogazione, Materia } from '../lib/tipi'
import { BadgeStato } from './BadgeStato'
import { Bottone, Caricamento, CLASSE_INPUT, Etichetta, LinkBottone, Riquadro, Scheda } from './ui'
import { FormInterrogazione } from './FormInterrogazione'
import { useAvvisi } from './Avvisi'

/** Elenco delle materie della classe con le loro interrogazioni. */
export function InterrogazioniClasse({ classId, staff, mioUid }: { classId: string; staff: boolean; mioUid: string }) {
  const materie = useQuery<Materia>(db && rifMaterie(db, classId), `materie/${classId}`)
  const elenco = [...(materie.dati ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  const [nuova, setNuova] = useState(false)

  return (
    <Scheda
      titolo="Interrogazioni"
      azioni={
        staff ? (
          <div className="flex flex-wrap gap-2">
            {elenco.length > 0 && !nuova && (
              <Bottone variante="piccolo" onClick={() => setNuova(true)}>
                Nuova interrogazione
              </Bottone>
            )}
            <LinkBottone to={`/classe/${classId}/configura`}>Materie e calendario</LinkBottone>
          </div>
        ) : undefined
      }
    >
      {nuova && (
        <div className="mb-4">
          <NuovaInterrogazione classId={classId} materie={elenco} mioUid={mioUid} onAnnulla={() => setNuova(false)} />
        </div>
      )}
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

/** Crea un'interrogazione scegliendo la materia, senza entrare prima nella sua pagina. */
function NuovaInterrogazione(p: { classId: string; materie: ConId<Materia>[]; mioUid: string; onAnnulla: () => void }) {
  const [subjectId, setSubjectId] = useState(p.materie[0]?.id ?? '')
  const navigate = useNavigate()
  const avvisi = useAvvisi()
  const materia = p.materie.find((m) => m.id === subjectId)

  return (
    <div className="space-y-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/50">
      <Etichetta testo="Materia">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={`${CLASSE_INPUT} max-w-72`}>
          {p.materie.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </Etichetta>
      {materia && db && (
        <FormInterrogazione
          key={materia.id}
          giorniMateria={materia.orario}
          testoSalva="Crea interrogazione"
          onAnnulla={p.onAnnulla}
          onSalva={async (d) => {
            const id = await creaInterrogazione(db!, p.classId, materia.id, d, p.mioUid)
            avvisi.mostra('Interrogazione creata: ora tutti possono scegliere la preferenza')
            navigate(percorsoInterrogazione(p.classId, materia.id, id))
          }}
        />
      )}
    </div>
  )
}
