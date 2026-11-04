import { useState } from 'react'
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { db } from '../../lib/firebase'
import { messaggioErrore } from '../../lib/errori'
import { riordinaLista } from '../../lib/gestioneLista'
import { sposta } from '../../lib/lista'
import type { Membro } from '../../lib/tipi'
import { Avatar, Bottone, Riquadro, Scheda } from '../ui'
import { ArrowDown, ArrowUp, ArrowUpDown, GripVertical } from 'lucide-react'
import { useAvvisi } from '../Avvisi'

type Props = {
  r: { classId: string; subjectId: string; interrogazioneId: string }
  ordine: string[]
  interrogati: Record<string, string>
  membri: Map<string, Membro>
  mioUid: string
  onFine: () => void
}

/** Riordino della lista trascinando i nomi (o con le frecce). Si salva tutto insieme alla fine. */
export function RiordinaLista(p: Props) {
  const [ordine, setOrdine] = useState(p.ordine)
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()
  const nome = (uid: string) => p.membri.get(uid)?.nome ?? 'Ex membro'
  const posizione = (uid: unknown) => ordine.indexOf(String(uid)) + 1

  const sensori = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const annunci: Announcements = {
    onDragStart: ({ active }) => `Preso ${nome(String(active.id))}, posizione ${posizione(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `${nome(String(active.id))} sopra la posizione ${posizione(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${nome(String(active.id))} lasciato in posizione ${posizione(over.id)}.` : `${nome(String(active.id))} lasciato.`,
    onDragCancel: ({ active }) => `Spostamento di ${nome(String(active.id))} annullato.`,
  }

  function fineTrascinamento(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return
    setOrdine((o) => sposta(o, o.indexOf(String(e.active.id)), o.indexOf(String(e.over!.id))))
  }

  async function salva() {
    if (!db) return
    setInCorso(true)
    setErrore(null)
    try {
      const d = db
      const prima = p.ordine
      await riordinaLista(d, p.r, ordine, p.mioUid)
      avvisi.mostra('Ordine salvato', { annulla: () => riordinaLista(d, p.r, prima, p.mioUid) })
      p.onFine()
    } catch (err) {
      setErrore(messaggioErrore(err))
      setInCorso(false)
    }
  }

  const cambiato = ordine.some((u, i) => u !== p.ordine[i])

  return (
    <Scheda titolo="Riordina la lista" icona={ArrowUpDown} tono="evidenza">
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        Trascina i nomi tenendo premuto ⠿, oppure usa le frecce. Le modifiche si salvano solo con "Salva ordine".
      </p>
      <DndContext
        sensors={sensori}
        collisionDetection={closestCenter}
        onDragEnd={fineTrascinamento}
        accessibility={{
          announcements: annunci,
          screenReaderInstructions: {
            draggable:
              'Per spostare un nome premi spazio o invio, usa le frecce su e giù, poi premi di nuovo spazio o invio. Esc per annullare.',
          },
        }}
      >
        <SortableContext items={ordine} strategy={verticalListSortingStrategy}>
          <ol className="space-y-1.5" aria-label="Nuovo ordine">
            {ordine.map((uid, i) => (
              <Riga
                key={uid}
                uid={uid}
                indice={i}
                totale={ordine.length}
                membro={p.membri.get(uid)}
                interrogato={!!p.interrogati[uid]}
                io={uid === p.mioUid}
                onSposta={(a) => setOrdine((o) => sposta(o, i, a))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      {errore && (
        <div className="mt-3">
          <Riquadro tono="errore">{errore}</Riquadro>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Bottone onClick={salva} disabled={inCorso || !cambiato}>
          {inCorso ? 'Salvataggio…' : 'Salva ordine'}
        </Bottone>
        <Bottone variante="secondario" onClick={p.onFine} disabled={inCorso}>
          Annulla
        </Bottone>
      </div>
    </Scheda>
  )
}

function Riga(p: {
  uid: string
  indice: number
  totale: number
  membro: Membro | undefined
  interrogato: boolean
  io: boolean
  onSposta: (nuovaPosizione: number) => void
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: p.uid,
  })
  const nome = p.membro?.nome ?? 'Ex membro'
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl border bg-white px-2 py-2 dark:bg-slate-900 ${
        isDragging ? 'relative z-10 border-accento shadow-lg' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Trascina ${nome}`}
        className="cursor-grab touch-none rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 active:cursor-grabbing dark:hover:bg-slate-800"
      >
        <GripVertical aria-hidden className="size-5" />
      </button>
      <span className="w-6 text-right font-mono text-sm text-slate-600 dark:text-slate-400">{p.indice + 1}</span>
      <Avatar nome={nome} foto={p.membro?.foto ?? null} />
      <span className={`min-w-0 flex-1 truncate ${p.interrogato ? 'text-slate-400 line-through' : ''}`}>
        {nome}
        {p.io && ' (tu)'}
      </span>
      <span className="flex gap-1">
        <button
          type="button"
          aria-label={`Sposta su ${nome}`}
          disabled={p.indice === 0}
          onClick={() => p.onSposta(p.indice - 1)}
          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ArrowUp aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          aria-label={`Sposta giù ${nome}`}
          disabled={p.indice === p.totale - 1}
          onClick={() => p.onSposta(p.indice + 1)}
          className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-30 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          <ArrowDown aria-hidden className="size-4" />
        </button>
      </span>
    </li>
  )
}
