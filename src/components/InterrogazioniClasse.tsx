import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { orderBy, query } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { avvisaServer } from '../lib/avvisaServer'
import { rifInterrogazioni, rifMaterie } from '../lib/configurazione'
import { creaDaModulo } from '../lib/preferenze'
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

/** Le interrogazioni della classe, per materia: compaiono solo le materie che ne hanno almeno una. */
export function InterrogazioniClasse({ classId, staff, mioUid }: { classId: string; staff: boolean; mioUid: string }) {
  const materie = useQuery<Materia>(db && rifMaterie(db, classId), `materie/${classId}`)
  const elenco = [...(materie.dati ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  const [nuova, setNuova] = useState(false)
  // quante interrogazioni ha ogni materia (undefined finché non si sa)
  const [conteggi, setConteggi] = useState<Record<string, number>>({})
  const segnaConteggio = useCallback(
    (id: string, n: number) => setConteggi((c) => (c[id] === n ? c : { ...c, [id]: n })),
    [],
  )
  const nessuna = elenco.length > 0 && elenco.every((m) => conteggi[m.id] === 0)
  const inCaricamento = elenco.some((m) => conteggi[m.id] === undefined)

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
        staff ? (
          <Vuoto icona={BookOpen} titolo="Nessuna materia">
            Inizia da "Materie e calendario": aggiungi le materie e i giorni di lezione.
          </Vuoto>
        ) : (
          <Vuoto icona={ClipboardList} titolo="Nessuna interrogazione" />
        )
      ) : (
        <>
          {inCaricamento && <Caricamento />}
          {nessuna && <Vuoto icona={ClipboardList} titolo="Nessuna interrogazione" />}
          <ul className="space-y-5">
            {elenco.map((m) => (
              <MateriaConInterrogazioni key={m.id} classId={classId} materia={m} onConteggio={segnaConteggio} />
            ))}
          </ul>
        </>
      )}
    </Scheda>
  )
}

function MateriaConInterrogazioni({
  classId,
  materia,
  onConteggio,
}: {
  classId: string
  materia: ConId<Materia>
  onConteggio: (id: string, n: number) => void
}) {
  const interrogazioni = useQuery<Interrogazione>(
    db && query(rifInterrogazioni(db, classId, materia.id), orderBy('creato', 'desc')),
    `interrogazioni/${classId}/${materia.id}`,
  )
  const attive = (interrogazioni.dati ?? []).filter((i) => i.stato !== 'conclusa')
  const totale = interrogazioni.dati?.length
  useEffect(() => {
    if (totale !== undefined) onConteggio(materia.id, totale)
  }, [totale, materia.id, onConteggio])

  // una materia senza interrogazioni non compare (quelle solo concluse sì: da lì si riaprono le liste vecchie)
  if (!totale) return null

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
      {attive.length === 0 && (
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
            const id = await creaDaModulo(db!, p.classId, materia.id, d, p.mioUid)
            if (!d.senzaLista) avvisaServer('nuova-interrogazione', { classId: p.classId, subjectId: materia.id, interrogazioneId: id })
            avvisi.mostra(d.senzaLista ? 'Interrogazione creata, senza lista' : 'Interrogazione creata: ora tutti possono scegliere la preferenza')
            navigate(percorsoInterrogazione(p.classId, materia.id, id))
          }}
        />
      )}
    </Modulo>
  )
}
