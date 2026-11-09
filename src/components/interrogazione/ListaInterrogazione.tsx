import { useState, type ReactNode } from 'react'
import { db } from '../../lib/firebase'
import { formattaGiorno, momentoLocale, oggiISO, type Calendario } from '../../lib/calendar'
import { rifLista, rifRapporto } from '../../lib/configurazione'
import { messaggioErrore } from '../../lib/errori'
import { testoStima } from '../../lib/estimate'
import { dateDisponibili, programmaLista, type DatiProgramma } from '../../lib/programma'
import { Imprevisti } from './Imprevisti'
import { NonCiSaro } from './NonCiSaro'
import { useAdesso } from '../../lib/useAdesso'
import { segnaInterrogati, togliInterrogato } from '../../lib/gestioneLista'
import { useDocumento } from '../../lib/hooks'
import type { DocLista, DocRapporto, Interrogazione, Membro } from '../../lib/tipi'
import { Avatar, Badge, Bottone, Caricamento, Colonne, Riquadro, Scheda, Soffietto } from '../ui'
import { ArrowLeftRight, CalendarCheck, ChartPie, Check, Hourglass, ListOrdered, PartyPopper, Pencil, TriangleAlert, Undo2 } from 'lucide-react'
import { useConferma } from '../Conferma'
import { annullaScambio, chiediScambio, richiestaInAttesa, validita } from '../../lib/scambi'
import { PannelloScambi, useRifiutoAutomatico, useScambi } from './Scambi'
import { avvisaServer } from '../../lib/avvisaServer'
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
  /** capo, vice e docenti con permesso: riordinano la lista (gli interrogati li segnano solo capo e vice) */
  puoModificare: boolean
  /** uid con il badge DSA/BES visibile a chi guarda */
  dsa: Set<string>
  /** entro quanti giorni prima si può dire "non ci sarò" */
  giorniAnticipo: number
  nomeMateria: string
  /** sul computer: due colonne */
  desktop?: boolean
  /** in cima (es. il modulo di modifica dell'interrogazione) */
  sopra?: ReactNode
  /** pannelli in più per la colonna di destra (o in fondo sul telefono) */
  laterale?: ReactNode
}

/** La lista generata, con la data stimata per ognuno e gli strumenti per chi la gestisce. */
export function ListaInterrogazione(p: Props) {
  const lista = useDocumento<DocLista>(db && rifLista(db, p.classId, p.subjectId, p.interrogazioneId))
  const [riordino, setRiordino] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const avvisi = useAvvisi()
  const conferma = useConferma()
  // si aggiorna da solo: all'ora di uscita chi non è stato interrogato slitta alla lezione dopo
  const adesso = useAdesso()
  const r = {
    classId: p.classId,
    subjectId: p.subjectId,
    interrogazioneId: p.interrogazioneId,
  }
  const ioMembro = p.membri.find((m) => m.uid === p.mioUid)
  const vuota: DocLista = { ordine: [], interrogati: {}, generataDa: '' }
  const datiLista = lista.dati ?? vuota
  // Scambi: solo per chi è in lista, non ancora interrogato, finché la lista è in corso
  const senzaLista = !!p.interrogazione.senzaLista
  const possoScambiare =
    !senzaLista && p.interrogazione.stato === 'lista' && datiLista.ordine.includes(p.mioUid) && !datiLista.interrogati[p.mioUid]
  const scambi = useScambi(r, p.mioUid, datiLista, possoScambiare)
  const rifiutoAutomatico = !!ioMembro?.rifiutaScambi
  useRifiutoAutomatico(r, p.mioUid, rifiutoAutomatico, scambi.inArrivo)

  if (lista.errore) return <Riquadro tono="errore">{messaggioErrore(lista.errore)}</Riquadro>
  if (lista.dati === undefined) return <Caricamento />
  if (lista.dati === null) return <Riquadro tono="avviso">La lista non è ancora disponibile.</Riquadro>

  const { ordine, interrogati } = lista.dati
  const fissi = lista.dati.fissi ?? {}
  const ritardi = lista.dati.ritardi ?? {}
  const perUid = new Map(p.membri.map((m) => [m.uid, m]))
  const datiProgramma: DatiProgramma = {
    ordine,
    fissi,
    interrogati,
    perLezione: p.interrogazione.perLezione,
    giorni: p.interrogazione.giorni,
    subjectId: p.subjectId,
    cal: p.cal,
    adesso: momentoLocale(adesso),
    creata: p.interrogazione.creato ? oggiISO(p.interrogazione.creato.toDate()) : null,
  }
  const programma = programmaLista(datiProgramma)
  const stimaDi = (uid: string) => programma.stime.get(uid) ?? null
  const stima = (uid: string) => {
    const s = stimaDi(uid)
    if (senzaLista) return s?.tipo === 'non-disponibile' && s.prossimaLezione ? `Possibile: ${formattaGiorno(s.prossimaLezione)}` : 'Data non prevista'
    return s ? testoStima(s) : 'Stima non disponibile'
  }
  const totale = programma.righe.length
  const fatti = programma.righe.filter((x) => x.interrogato).length
  const miaPosizione = ordine.indexOf(p.mioUid)
  const miaData = fissi[p.mioUid]
  const miaStima = stimaDi(p.mioUid)
  // DSA/BES: la data effettiva (se la lezione scelta è passata senza interrogazione, quella dopo)
  const dataEffettiva = miaStima?.tipo === 'data' ? miaStima.data : null

  async function chiediA(uid: string) {
    if (!db || !lista.dati) return
    const d = db
    const l = lista.dati
    const chi = perUid.get(uid)?.nome ?? 'Ex membro'
    const aPos = ordine.indexOf(uid)
    // Una sola richiesta aperta: quella in attesa (se c'è) viene sostituita
    const inAttesa = scambi.mie.find((s) => s.stato === 'attesa' && validita(s, l) === 'valida')
    const vecchio = inAttesa ? (perUid.get(ordine[inAttesa.aPos] ?? '')?.nome ?? 'un compagno') : null
    const ok = await conferma({
      titolo: `Chiedere lo scambio a ${chi}?`,
      testo: `Tu passeresti dal n° ${miaPosizione + 1} al n° ${aPos + 1} (${stima(uid).toLowerCase()}). Finché ${chi} non accetta non cambia niente.${
        vecchio ? ` La richiesta che hai fatto a ${vecchio} viene annullata: se ne può avere una sola alla volta.` : ''
      }`,
      pulsante: 'Chiedi lo scambio',
    })
    if (!ok) return
    try {
      const id = await chiediScambio(d, r, p.mioUid, l, aPos, scambi.mie, true)
      avvisaServer('scambio-richiesta', r, id)
      avvisi.mostra(`Richiesta inviata a ${chi}`, {
        annulla: () => annullaScambio(d, r, id),
      })
    } catch (e) {
      avvisi.errore(messaggioErrore(e))
    }
  }

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

  const pezzoBanner = (
    <>
      {(miaPosizione >= 0 || miaData) && (
        <section
          role="status"
          className={`flex gap-4 rounded-2xl p-4 shadow-sm sm:p-5 ${
            interrogati[p.mioUid] ? 'bg-emerald-700 text-white' : 'bg-gradient-to-br from-accento to-blue-700 text-white'
          }`}
        >
          <span
            aria-hidden
            className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-white/15 text-3xl leading-none font-bold"
          >
            {/* il numero "salta" quando cambia (scambio, riordino) */}
            <span key={interrogati[p.mioUid] ? 'fatto' : miaPosizione} className="pop">
              {interrogati[p.mioUid] ? (
                <Check className="size-8" />
              ) : miaData ? (
                <CalendarCheck className="size-8" />
              ) : senzaLista ? (
                <Hourglass className="size-8" />
              ) : (
                miaPosizione + 1
              )}
            </span>
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-lg font-bold">
              {miaData
                ? interrogati[p.mioUid]
                  ? 'Data fissa'
                  : `Interrogazione ${dataEffettiva ? formattaGiorno(dataEffettiva).toLowerCase() : 'da fissare'}`
                : senzaLista
                  ? interrogati[p.mioUid]
                    ? 'Interrogato'
                    : 'Non ancora interrogato'
                  : `Sei il n° ${miaPosizione + 1} di ${ordine.length}`}
            </p>
            {interrogati[p.mioUid] ? (
              <p className="text-emerald-50">Sei stato interrogato {formattaGiorno(interrogati[p.mioUid]!).toLowerCase()}.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-blue-50">
                  {miaData
                    ? dataEffettiva && dataEffettiva !== miaData
                      ? `La tua data era ${formattaGiorno(miaData).toLowerCase()}: non sei stato interrogato, quindi passi alla lezione successiva.`
                      : 'Hai una data fissa: resta questa anche se la lista cambia.'
                    : stima(p.mioUid)}
                </p>
                {/* chi modifica le liste si segna da solo nella scheda qui sotto */}
                {!p.staff && <SonoStatoInterrogato r={r} uid={p.mioUid} />}
                {!senzaLista && p.interrogazione.stato === 'lista' && (
                  <NonCiSaro r={r} uid={p.mioUid} programma={datiProgramma} giorniAnticipo={p.giorniAnticipo} />
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </>
  )
  const pezzoScambi = (
    <>
      {possoScambiare && (
        <PannelloScambi
          r={r}
          uid={p.mioUid}
          lista={lista.dati}
          membri={perUid}
          stima={stima}
          nomeMateria={p.nomeMateria}
          nomeInterrogazione={p.interrogazione.nome}
          mie={scambi.mie}
          inArrivo={scambi.inArrivo}
          rifiutoAutomatico={rifiutoAutomatico}
        />
      )}
    </>
  )
  const pezzoConclusa = (
    <>
      {p.interrogazione.stato === 'conclusa' && (
        <Riquadro tono="ok" titolo="Interrogazione conclusa" icona={PartyPopper}>
          Sono stati interrogati tutti.
        </Riquadro>
      )}
    </>
  )
  const pezzoGestione = (
    <>
      {p.staff && !riordino && (
        <>
          <Segnalazioni r={r} membri={perUid} mioUid={p.mioUid} />
          <SegnaInterrogati
            key={`${ordine
              .filter((u) => !interrogati[u])
              .slice(0, 10)
              .join()}|${Object.keys(fissi)
              .filter((u) => !interrogati[u])
              .join()}|${p.interrogazione.perLezione}`}
            r={r}
            interrogazione={p.interrogazione}
            ordine={ordine}
            fissi={fissi}
            senzaLista={senzaLista}
            interrogati={interrogati}
            membri={perUid}
            cal={p.cal}
            mioUid={p.mioUid}
            programma={datiProgramma}
          />
        </>
      )}
    </>
  )
  const pezzoLista = (
    <>
      {riordino ? (
        <RiordinaLista
          r={r}
          ordine={ordine}
          fissi={fissi}
          interrogati={interrogati}
          membri={perUid}
          mioUid={p.mioUid}
          onFine={() => setRiordino(false)}
        />
      ) : (
        <Scheda
          titolo="Lista"
          icona={ListOrdered}
          sottotitolo={`${fatti} su ${totale} interrogati`}
          azioni={
            p.puoModificare && !senzaLista && ordine.length > 1 ? (
              <Bottone variante="piccolo" icona={Pencil} aria-label="Modifica la lista" onClick={() => setRiordino(true)}>
                Modifica
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
            {programma.righe.map(({ uid, numero, fissa }) => {
              const m = perUid.get(uid)
              const io = uid === p.mioUid
              const quando = interrogati[uid]
              const i = numero === null ? -1 : numero - 1
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
                    {quando ? (
                      <Check aria-label="interrogato" className="size-4" />
                    ) : fissa ? (
                      <CalendarCheck aria-label="data fissa" className="size-4" />
                    ) : senzaLista ? (
                      '•'
                    ) : (
                      numero
                    )}
                  </span>
                  <Avatar nome={m?.nome ?? '?'} foto={m?.foto ?? null} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <span className={`truncate font-medium ${quando ? 'text-slate-400 line-through' : ''}`}>
                        {m?.nome ?? 'Ex membro'}
                      </span>
                      {io && <Badge>tu</Badge>}
                      {p.dsa.has(uid) && <Badge colore="ambra">DSA/BES</Badge>}
                      {fissa && !quando && <Badge colore="viola">fissato</Badge>}
                      {!quando && (ritardi[uid] ?? 0) > 0 && <BadgeRitardo volte={ritardi[uid]!} />}
                      {quando && <Badge colore="verde">interrogato</Badge>}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{quando ? formattaGiorno(quando) : stima(uid)}</p>
                  </div>
                  {possoScambiare &&
                    numero !== null &&
                    uid !== p.mioUid &&
                    !quando &&
                    !riordino &&
                    (richiestaInAttesa(scambi.mie, i, lista.dati!) ? (
                      <Badge colore="viola">richiesta inviata</Badge>
                    ) : m && !m.rifiutaScambi ? (
                      <Bottone
                        variante="piccolo"
                        icona={ArrowLeftRight}
                        aria-label={`Chiedi scambio a ${m.nome}`}
                        onClick={() => chiediA(uid)}
                      >
                        Scambia
                      </Bottone>
                    ) : null)}
                  {quando && p.staff && (
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
                righe: programma.righe.map(({ uid, numero }) => ({
                  numero: senzaLista ? null : numero,
                  nome: perUid.get(uid)?.nome ?? 'Ex membro',
                  interrogato: !!interrogati[uid],
                  nota: interrogati[uid] ? `interrogato ${formattaGiorno(interrogati[uid]!)}` : stima(uid),
                })),
              })}
            />
          </div>
        </Scheda>
      )}
    </>
  )
  const pezzoImprevisti = (
    <>
      {/* imprevisti: solo capoclasse e vice */}
      {p.staff && !riordino && p.interrogazione.stato !== 'raccolta' && (
        <Imprevisti
          r={r}
          composizione={{ ordine, fissi, interrogati }}
          senzaLista={senzaLista}
          membri={perUid}
          mioUid={p.mioUid}
          date={dateDisponibili({
            giorni: p.interrogazione.giorni,
            subjectId: p.subjectId,
            cal: p.cal,
            adesso: momentoLocale(adesso),
            creata: p.interrogazione.creato ? oggiISO(p.interrogazione.creato.toDate()) : null,
            perLezione: p.interrogazione.perLezione,
            numeroStudenti: Math.max(totale, 1),
            // per un imprevisto si può fissare anche più avanti
            quante: 40,
          })}
        />
      )}
    </>
  )
  const pezzoRapporto = (
    <>
      {p.staff && <RapportoSoddisfazione {...p} />}
      <StoricoLista classId={p.classId} subjectId={p.subjectId} interrogazioneId={p.interrogazioneId} membri={perUid} />
    </>
  )

  return (
    <Colonne
      desktop={!!p.desktop}
      principale={
        <>
          {p.sopra}
          {pezzoBanner}
          {pezzoScambi}
          {pezzoConclusa}
          {pezzoLista}
        </>
      }
      laterale={
        <>
          {pezzoGestione}
          {pezzoRapporto}
          {p.laterale}
          {pezzoImprevisti}
        </>
      }
      telefono={
        <>
          {p.sopra}
          {pezzoBanner}
          {pezzoScambi}
          {pezzoConclusa}
          {pezzoGestione}
          {pezzoLista}
          {pezzoRapporto}
          {p.laterale}
          {pezzoImprevisti}
        </>
      }
    />
  )
}

/** Attenzione: ha detto dopo il termine che non ci sarebbe stato, o ha saltato. Dura finché non viene interrogato. */
function BadgeRitardo({ volte }: { volte: number }) {
  const testo = `Assente dopo la scadenza${volte > 1 ? `, ${volte} volte` : ''}`
  return (
    <span role="img" aria-label={testo} title={testo}>
      <Badge colore="rosso">
        <TriangleAlert aria-hidden className="size-3.5" />
        {volte > 1 && <span className="ml-1 font-bold">{volte}</span>}
      </Badge>
    </span>
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
      <ul className="space-y-2 text-sm">
        <li>
          Hanno risposto <strong>{r.risposte}</strong> su {r.totale}
          {r.indifferenti > 0 && `, di cui ${r.indifferenti} "non mi interessa"`}.
        </li>
        {riga('Inizio ottenuto', r.inizio.ottenute, r.inizio.richieste)}
        {riga('Metà ottenuta', r.meta.ottenute, r.meta.richieste)}
        {riga('Fine ottenuta', r.fine.ottenute, r.fine.richieste)}
        {r.dsa.richieste > 0 && (
          <li>
            DSA/BES con la data scelta: <strong>{r.dsa.richieste}</strong>
          </li>
        )}
        <li className="text-xs text-slate-600 dark:text-slate-400">
          Seme del sorteggio: {r.seme}. Il rapporto si riferisce alla lista appena generata, prima di eventuali riordini.
        </li>
      </ul>
    </Soffietto>
  )
}
