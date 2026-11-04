import { useRef, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { BookOpen, CalendarDays, CalendarOff, CalendarPlus, Grid3x3, Pencil, Plus, Trash2, X } from 'lucide-react'
import { db } from '../lib/firebase'
import {
  conEccezione,
  dataValida,
  festeTra,
  formattaData,
  formattaGiorno,
  oggiISO,
  senzaEccezione,
  vacanzeRegionaliMancanti,
  type Calendario,
  type Eccezione,
} from '../lib/calendar'
import { aggiornaMateria, creaMateria, eliminaMateria, rifMaterie, salvaCalendario } from '../lib/configurazione'
import { messaggioErrore } from '../lib/errori'
import { useQuery, type ConId } from '../lib/hooks'
import { puoGestireDSA } from '../lib/membri'
import { useCalendario } from '../lib/useCalendario'
import { useClasse } from '../lib/useClasse'
import type { Materia } from '../lib/tipi'
import { StatoClasse } from '../components/StatoClasse'
import { useAvvisi } from '../components/Avvisi'
import { useConferma } from '../components/Conferma'
import { GiorniMateria } from '../components/GiorniMateria'
import { OrarioSettimanale } from '../components/OrarioSettimanale'
import {
  Bottone,
  BottoneIcona,
  Caricamento,
  Campo,
  CLASSE_INPUT,
  Etichetta,
  IntestazionePagina,
  LinkBottone,
  Modulo,
  Riquadro,
  Scheda,
  Schede,
  SelettoreGiorni,
  Soffietto,
} from '../components/ui'

/** Materie e calendario della classe: li configurano capoclasse e vice. */
export default function Configura() {
  const { classId = '' } = useParams()
  const dati = useClasse(classId)
  const { cal } = useCalendario(classId)
  const materie = useQuery<Materia>(db && rifMaterie(db, classId), `materie/${classId}`)
  const [parametri, setParametri] = useSearchParams()
  const sezione =
    (['materie', 'orario', 'calendario'] as const).find((x) => x === parametri.get('sezione')) ?? 'materie'
  const animazioneScheda = useAnimazioneScheda(['materie', 'orario', 'calendario'].indexOf(sezione))

  if (dati.stato !== 'pronto') return <StatoClasse dati={dati} />
  if (!puoGestireDSA(dati.io)) {
    return (
      <Scheda titolo="Solo per capoclasse e vice">
        <LinkBottone to={`/classe/${classId}`}>Torna alla classe</LinkBottone>
      </Scheda>
    )
  }

  const elencoMaterie = [...(materie.dati ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))

  return (
    <>
      <IntestazionePagina
        indietro={{ to: `/classe/${classId}`, testo: dati.classe.nome }}
        titolo="Materie e calendario"
      />

      <Schede
        etichetta="Sezioni"
        attiva={sezione}
        onCambia={(id) => setParametri(id === 'materie' ? {} : { sezione: id }, { replace: true })}
        schede={[
          { id: 'materie', etichetta: 'Materie', icona: BookOpen },
          { id: 'orario', etichetta: 'Orario', icona: Grid3x3 },
          { id: 'calendario', etichetta: 'Calendario', icona: CalendarDays },
        ]}
      />

      {/* cambiando scheda il contenuto scorre dal lato della scheda scelta */}
      <div key={sezione} className={`flex flex-col gap-4 sm:gap-5 ${animazioneScheda}`}>
        {sezione === 'materie' && (
          <Scheda
            titolo="Materie"
            icona={BookOpen}
            sottotitolo="Quelle con interrogazioni da organizzare, con i giorni di lezione."
          >
            {materie.errore ? (
              <Riquadro tono="errore">{messaggioErrore(materie.errore)}</Riquadro>
            ) : !materie.dati ? (
              <Caricamento />
            ) : (
              <div className="space-y-4">
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {elencoMaterie.map((m) => (
                    <RigaMateria key={m.id} classId={classId} materia={m} />
                  ))}
                </ul>
                <NuovaMateria classId={classId} />
              </div>
            )}
          </Scheda>
        )}

        {sezione === 'orario' &&
          (cal ? <OrarioSettimanale classId={classId} materie={elencoMaterie} cal={cal} /> : <Caricamento />)}

        {sezione === 'calendario' &&
          (cal ? <ConfiguraCalendario classId={classId} cal={cal} materie={elencoMaterie} /> : <Caricamento />)}
      </div>
    </>
  )
}

/** Da destra se la scheda scelta è più a destra di quella di prima, da sinistra altrimenti. */
function useAnimazioneScheda(indice: number): string {
  const ultima = useRef({ indice, classe: '' })
  if (ultima.current.indice !== indice) {
    ultima.current = { indice, classe: indice > ultima.current.indice ? 'pagina-avanti' : 'pagina-indietro' }
  }
  return ultima.current.classe
}

// ───────────── Materie ─────────────

function NuovaMateria({ classId }: { classId: string }) {
  const avvisi = useAvvisi()
  const [nome, setNome] = useState('')
  const [orario, setOrario] = useState<number[]>([])
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)

  async function invia(e: FormEvent) {
    e.preventDefault()
    if (!db) return
    // Il campo si svuota subito (si può già scrivere la materia successiva); torna com'era se il salvataggio fallisce
    const dati = { nome, orario }
    setNome('')
    setOrario([])
    setInCorso(true)
    setErrore(null)
    try {
      await creaMateria(db, classId, dati)
      avvisi.mostra(`${dati.nome.trim()} aggiunta`)
    } catch (err) {
      setNome(dati.nome)
      setOrario(dati.orario)
      setErrore(messaggioErrore(err))
    } finally {
      setInCorso(false)
    }
  }

  return (
    <form onSubmit={invia}>
      <Modulo>
        <p className="font-semibold">Aggiungi una materia</p>
        <Campo etichetta="Nome" valore={nome} onChange={setNome} placeholder="Es. Matematica" maxLength={40} />
        <SelettoreGiorni etichetta="Giorni di lezione" valore={orario} onChange={setOrario} />
        {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
        <Bottone type="submit" icona={Plus} disabled={inCorso || !nome.trim()}>
          Aggiungi materia
        </Bottone>
      </Modulo>
    </form>
  )
}

function RigaMateria({ classId, materia }: { classId: string; materia: ConId<Materia> }) {
  const [modifica, setModifica] = useState(false)
  const [nome, setNome] = useState(materia.nome)
  const [orario, setOrario] = useState<number[]>(materia.orario)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()
  const conferma = useConferma()

  async function salva(e: FormEvent) {
    e.preventDefault()
    if (!db) return
    setErrore(null)
    try {
      await aggiornaMateria(db, classId, materia.id, { nome, orario })
      avvisi.mostra('Materia aggiornata')
      setModifica(false)
    } catch (err) {
      setErrore(messaggioErrore(err))
    }
  }

  async function elimina() {
    if (!db) return
    const ok = await conferma({
      titolo: `Eliminare ${materia.nome}?`,
      testo: 'Spariscono anche tutte le sue interrogazioni, con preferenze e liste.',
      pulsante: 'Elimina',
      pericolo: true,
    })
    if (!ok) return
    try {
      await eliminaMateria(db, classId, materia.id)
      avvisi.mostra(`${materia.nome} eliminata`)
    } catch (err) {
      setErrore(messaggioErrore(err))
    }
  }

  if (modifica) {
    return (
      <li className="py-3">
        <form onSubmit={salva} className="space-y-3">
          <Campo etichetta="Nome" valore={nome} onChange={setNome} maxLength={40} />
          <SelettoreGiorni etichetta="Giorni di lezione" valore={orario} onChange={setOrario} />
          {errore && <p className="text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
          <div className="flex gap-2">
            <Bottone type="submit" variante="piccolo">
              Salva
            </Bottone>
            <Bottone
              variante="piccolo"
              onClick={() => {
                setModifica(false)
                setNome(materia.nome)
                setOrario(materia.orario)
              }}
            >
              Annulla
            </Bottone>
          </div>
        </form>
      </li>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <div className="min-w-0 flex-1">
        <Link to={`/classe/${classId}/materia/${materia.id}`} className="font-semibold hover:underline">
          {materia.nome}
        </Link>
        <GiorniMateria giorni={materia.orario} />
      </div>
      <div className="flex gap-0.5">
        <BottoneIcona icona={Pencil} etichetta={`Modifica ${materia.nome}`} onClick={() => setModifica(true)} />
        <BottoneIcona icona={Trash2} etichetta={`Elimina ${materia.nome}`} onClick={elimina} />
      </div>
      {errore && <p className="basis-full text-sm text-rose-700 dark:text-rose-300">{errore}</p>}
    </li>
  )
}

// ───────────── Calendario ─────────────

function ConfiguraCalendario({
  classId,
  cal,
  materie,
}: {
  classId: string
  cal: Calendario
  materie: ConId<Materia>[]
}) {
  const [errore, setErrore] = useState<string | null>(null)
  const [salvataggio, setSalvataggio] = useState(false)
  const avvisi = useAvvisi()

  /** Salva il calendario; `avviso` e `annulla` per il messaggio in basso. */
  async function salva(nuovo: Calendario, avviso = 'Calendario salvato', annulla?: Calendario): Promise<boolean> {
    if (!db) return false
    const d = db
    setErrore(null)
    setSalvataggio(true)
    try {
      await salvaCalendario(d, classId, nuovo)
      avvisi.mostra(avviso, { annulla: annulla ? () => salvaCalendario(d, classId, annulla) : undefined })
      return true
    } catch (err) {
      setErrore(messaggioErrore(err))
      return false
    } finally {
      setSalvataggio(false)
    }
  }

  const giorniAttivi = cal.giorniScolastici.flatMap((on, i) => (on ? [i] : []))
  const nomeMateria = (id: string) => materie.find((m) => m.id === id)?.nome ?? 'Materia eliminata'
  const vacanze = cal.eccezioni.filter((e) => e.tipo === 'vacanza')
  const lezioni = cal.eccezioni.filter((e) => e.tipo !== 'vacanza')
  const mancanti = vacanzeRegionaliMancanti(cal)
  const oggi = oggiISO()
  const feste = festeTra(oggi < '2026-09-01' ? '2026-09-01' : oggi, cal.fineAnno)

  return (
    <>
      {errore && <Riquadro tono="errore">{errore}</Riquadro>}
      <Scheda
        titolo="Settimana e fine anno"
        icona={CalendarDays}
        azioni={salvataggio ? <span className="text-xs text-slate-500">Salvataggio…</span> : undefined}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <SelettoreGiorni
              etichetta="Giorni di scuola"
              valore={giorniAttivi}
              onChange={(g) =>
                salva(
                  { ...cal, giorniScolastici: [0, 1, 2, 3, 4, 5, 6].map((i) => g.includes(i)) },
                  'Giorni di scuola salvati',
                  cal,
                )
              }
            />
            <p className="text-xs text-slate-500">Le lezioni di una materia contano solo nei giorni di scuola.</p>
          </div>

          <FineAnno cal={cal} salva={salva} />
        </div>
      </Scheda>

      <Scheda
        titolo="Vacanze e chiusure"
        icona={CalendarOff}
        sottotitolo="Quelle dell'Emilia-Romagna 2026-27 ci sono già. Aggiungi ponti, festa del patrono, chiusure per elezioni…"
      >
        <div className="space-y-4">
          {mancanti.length > 0 && (
            <Riquadro tono="info" titolo="Vacanze regionali mancanti">
              <ul className="list-disc pl-5">
                {mancanti.map((v) => (
                  <li key={v.da}>
                    {v.descrizione}:{' '}
                    {v.da === v.a ? formattaData(v.da) : `${formattaData(v.da)} – ${formattaData(v.a)}`}
                  </li>
                ))}
              </ul>
              <div className="mt-2">
                <Bottone
                  variante="piccolo"
                  onClick={() => salva(mancanti.reduce(conEccezione, cal), 'Vacanze regionali aggiunte', cal)}
                >
                  Aggiungi le vacanze regionali
                </Bottone>
              </div>
            </Riquadro>
          )}
          <ElencoEccezioni
            eccezioni={vacanze}
            descrivi={(e) =>
              e.tipo === 'vacanza'
                ? `${e.descrizione || 'Vacanza'}: ${e.da === e.a ? formattaData(e.da) : `${formattaData(e.da)} – ${formattaData(e.a)}`}`
                : ''
            }
            onTogli={(e) => salva(senzaEccezione(cal, e), 'Vacanza tolta', cal)}
          />
          <NuovaVacanza onAggiungi={(e) => salva(conEccezione(cal, e), 'Vacanza aggiunta', cal)} />
        </div>
      </Scheda>

      <Scheda
        titolo="Lezioni extra o annullate"
        icona={CalendarPlus}
        sottotitolo="Una lezione in più o saltata (gita, assemblea, sciopero…)."
      >
        <div className="space-y-4">
          <ElencoEccezioni
            eccezioni={lezioni}
            descrivi={(e) =>
              e.tipo === 'vacanza'
                ? ''
                : `${formattaData(e.data)} · ${nomeMateria(e.subjectId)}: ${e.tipo === 'lezione-extra' ? 'lezione extra' : 'lezione annullata'}`
            }
            onTogli={(e) => salva(senzaEccezione(cal, e), 'Tolta dal calendario', cal)}
          />
          {materie.length === 0 ? (
            <p className="text-sm text-slate-500">Aggiungi prima una materia.</p>
          ) : (
            <NuovaLezione
              materie={materie}
              onAggiungi={(e) => salva(conEccezione(cal, e), 'Aggiunta al calendario', cal)}
            />
          )}
        </div>
      </Scheda>

      <Soffietto titolo={`Feste nazionali già incluse (${feste.length})`} icona={CalendarDays}>
        <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          {feste.map((f) => (
            <li key={f.data}>
              {formattaData(f.data)} · {f.nome}
            </li>
          ))}
        </ul>
      </Soffietto>
    </>
  )
}

function FineAnno({
  cal,
  salva,
}: {
  cal: Calendario
  salva: (c: Calendario, avviso?: string, annulla?: Calendario) => Promise<boolean>
}) {
  const [valore, setValore] = useState(cal.fineAnno)
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1">
        <Etichetta testo="Ultimo giorno di lezione">
          <input type="date" value={valore} onChange={(e) => setValore(e.target.value)} className={CLASSE_INPUT} />
        </Etichetta>
      </div>
      <Bottone
        variante="secondario"
        disabled={!valore || valore === cal.fineAnno}
        onClick={() => salva({ ...cal, fineAnno: valore }, 'Fine anno salvata', cal)}
      >
        Salva
      </Bottone>
    </div>
  )
}

function ElencoEccezioni(props: {
  eccezioni: Eccezione[]
  descrivi: (e: Eccezione) => string
  onTogli: (e: Eccezione) => void
}) {
  if (props.eccezioni.length === 0) return <p className="text-sm text-slate-500">Nessuna.</p>
  return (
    <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
      {props.eccezioni.map((e) => {
        const testo = props.descrivi(e)
        return (
          <li key={JSON.stringify(e)} className="flex items-center justify-between gap-3 py-3">
            <span>{testo}</span>
            <Bottone variante="piccolo" icona={X} aria-label={`Togli ${testo}`} onClick={() => props.onTogli(e)}>
              Togli
            </Bottone>
          </li>
        )
      })}
    </ul>
  )
}

function NuovaVacanza({ onAggiungi }: { onAggiungi: (e: Eccezione) => Promise<boolean> }) {
  const [da, setDa] = useState('')
  const [a, setA] = useState('')
  const [descrizione, setDescrizione] = useState('')

  async function invia(ev: FormEvent) {
    ev.preventDefault()
    const dati = { da, a, descrizione }
    setDa('')
    setA('')
    setDescrizione('')
    if (!(await onAggiungi({ tipo: 'vacanza', da: dati.da, a: dati.a || dati.da, descrizione: dati.descrizione }))) {
      setDa(dati.da)
      setA(dati.a)
      setDescrizione(dati.descrizione)
    }
  }

  return (
    <form onSubmit={invia} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2 sm:p-4 dark:bg-slate-950/50">
      <p className="font-semibold sm:col-span-2">Aggiungi una vacanza</p>
      <Etichetta testo="Dal">
        <input type="date" required value={da} onChange={(e) => setDa(e.target.value)} className={CLASSE_INPUT} />
      </Etichetta>
      <Etichetta testo="Al (incluso)" aiuto="Vuoto se è un giorno solo">
        <input type="date" value={a} min={da} onChange={(e) => setA(e.target.value)} className={CLASSE_INPUT} />
      </Etichetta>
      <div className="sm:col-span-2">
        <Campo
          etichetta="Descrizione"
          valore={descrizione}
          onChange={setDescrizione}
          placeholder="Es. Vacanze di Natale"
          maxLength={60}
        />
      </div>
      <div className="sm:col-span-2">
        <Bottone type="submit" icona={Plus} disabled={!da}>
          Aggiungi vacanza
        </Bottone>
      </div>
    </form>
  )
}

function NuovaLezione({
  materie,
  onAggiungi,
}: {
  materie: ConId<Materia>[]
  onAggiungi: (e: Eccezione) => Promise<boolean>
}) {
  const [data, setData] = useState('')
  const [subjectId, setSubjectId] = useState(materie[0]?.id ?? '')
  const [tipo, setTipo] = useState<'lezione-extra' | 'lezione-annullata'>('lezione-extra')

  async function invia(ev: FormEvent) {
    ev.preventDefault()
    const giorno = data
    setData('')
    if (!(await onAggiungi({ tipo, data: giorno, subjectId }))) setData(giorno)
  }

  return (
    <form onSubmit={invia} className="grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3 sm:p-4 dark:bg-slate-950/50">
      <p className="font-semibold sm:col-span-3">Aggiungi un cambio</p>
      <Etichetta testo="Giorno">
        <input type="date" required value={data} onChange={(e) => setData(e.target.value)} className={CLASSE_INPUT} />
      </Etichetta>
      <Etichetta testo="Materia">
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={CLASSE_INPUT}>
          {materie.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </Etichetta>
      <Etichetta testo="Cosa succede">
        <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={CLASSE_INPUT}>
          <option value="lezione-extra">Lezione extra</option>
          <option value="lezione-annullata">Lezione annullata</option>
        </select>
      </Etichetta>
      <div className="sm:col-span-3">
        <Bottone type="submit" icona={Plus} disabled={!data || !subjectId}>
          Aggiungi
        </Bottone>
      </div>
      {dataValida(data) && (
        <p className="text-xs text-slate-500 sm:col-span-3">
          {formattaGiorno(data)}/{data.slice(0, 4)}
        </p>
      )}
    </form>
  )
}
