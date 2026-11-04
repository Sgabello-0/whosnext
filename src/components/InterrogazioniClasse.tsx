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
import { Bottone, Caricamento, CLASSE_INPUT, Etichetta, LinkBottone, Modulo, Pallino, Riquadro, RigaLink, Scheda, Vuoto } from './ui'
import { BookOpen, CalendarCog, ClipboardList, Hourglass, ListOrdered, Plus } from 'lucide-react'
import { NOMI_GIORNI_BREVI } from '../lib/calendar'
import { FormInterrogazione } from './FormInterrogazione'
import { useAvvisi } from './Avvisi'

/** Elenco delle materie della classe con le loro interrogazioni. */
export function InterrogazioniClasse({ classId, staff, mioUid }: { classId: string; staff: boolean; mioUid: string }) {
  const materie = useQuery<Materia>(db && rifMaterie(db, classId), `materie/${classId}`)
  const elenco = [...(materie.dati ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  const [nuova, setNuova] = useState(false)

  return (
    <Scheda titolo="Interrogazioni" icona={ClipboardList}>
      {staff && (
        <div className="mb-4 flex flex-wrap gap-2">
          {elenco.length > 0 && !nuova && (
            <Bottone icona={Plus} onClick={() => setNuova(true)}>
              Nuova interrogazione
            </Bottone>
          )}
          <LinkBottone to={`/classe/${classId}/configura`} icona={CalendarCog} variante="tenue">
            Materie e calendario
          </LinkBottone>
        </div>
      )}
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
        <Vuoto icona={BookOpen} titolo="Nessuna materia">
          {staff
            ? 'Inizia da "Materie e calendario": aggiungi le materie e i giorni di lezione.'
            : 'Il capoclasse non ha ancora aggiunto materie.'}
        </Vuoto>
      ) : (
        <ul className="space-y-5">
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
      <Link
        to={`/classe/${classId}/materia/${materia.id}`}
        className="group flex items-baseline justify-between gap-2 rounded-lg py-1"
      >
        <span className="font-bold group-hover:underline">{materia.nome}</span>
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {materia.orario.length ? materia.orario.map((g) => NOMI_GIORNI_BREVI[g]).join(' · ') : 'nessun giorno fisso'}
        </span>
      </Link>
      {interrogazioni.dati && attive.length === 0 && (
        <p className="py-1 text-sm text-slate-600 dark:text-slate-400">Nessuna interrogazione in corso.</p>
      )}
      {attive.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {attive.map((i) => (
            <RigaLink
              key={i.id}
              to={`/classe/${classId}/materia/${materia.id}/interrogazione/${i.id}`}
              sinistra={
                i.stato === 'raccolta' ? (
                  <Pallino icona={Hourglass} colore="ambra" />
                ) : (
                  <Pallino icona={ListOrdered} colore="verde" />
                )
              }
            >
              <span className="block font-medium">{i.nome}</span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">
                {i.stato === 'raccolta'
                  ? `Preferenze entro ${formattaScadenza(i.scadenzaPreferenze.toDate())}`
                  : 'Lista pronta'}
              </span>
            </RigaLink>
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
    <Modulo>
      <p className="font-semibold">Nuova interrogazione</p>
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
    </Modulo>
  )
}
