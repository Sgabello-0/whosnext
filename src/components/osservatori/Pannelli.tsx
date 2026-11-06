import { ArrowLeftRight, BellRing, CalendarCheck, CheckCheck, Hourglass, ListChecks, Megaphone, Shuffle, Sparkles, type LucideIcon } from 'lucide-react'
import { formattaGiorno } from '../../lib/calendar'
import { confrontaDaFare, confrontaMie, voceMia, vociDaFare, type InterrogazioneOsservata, type VoceDaFare, type VoceMia } from '../../lib/daFare'
import { formattaScadenza, tempoMancante } from '../../lib/formatoDate'
import { percorsoInterrogazione } from '../../lib/messaggi'
import { useInterrogazioniOsservate } from '../../lib/raccolta'
import { descriviScelta } from '../../lib/testiPreferenze'
import { useAdesso } from '../../lib/useAdesso'
import { Pallino, RigaLink, Scheda, Vuoto } from '../ui'

function percorso(d: InterrogazioneOsservata): string {
  return percorsoInterrogazione(d.classId, d.subjectId, d.interrogazioneId)
}

function Titolo({ d, mostraClasse }: { d: InterrogazioneOsservata; mostraClasse: boolean }) {
  return (
    <span className="block font-semibold">
      {d.nomeMateria} – {d.nome}
      {mostraClasse && <span className="font-normal text-slate-600 dark:text-slate-400"> · {d.nomeClasse}</span>}
    </span>
  )
}

// ───────────── Da fare ─────────────

function testoDaFare(v: VoceDaFare): string {
  switch (v.tipo) {
    case 'scambio':
      return v.quante === 1 ? 'Un compagno ti chiede uno scambio di posto: rispondi' : `${v.quante} richieste di scambio di posto: rispondi`
    case 'genera':
      return 'Le preferenze sono chiuse: genera la lista'
    case 'segnalazioni':
      return v.quante === 1 ? '1 segnalazione "Sono stato interrogato" da confermare' : `${v.quante} segnalazioni da confermare`
    case 'segna':
      return `Segna chi è stato interrogato ${formattaGiorno(v.data).toLowerCase()}`
    case 'risposte':
      return `${v.risposte} su ${v.totale} hanno scelto · entro ${formattaScadenza(new Date(v.scadenza))}`
  }
}

const ICONA_DA_FARE: Record<VoceDaFare['tipo'], { icona: LucideIcon; colore: 'ambra' | 'blu' | 'viola' }> = {
  scambio: { icona: ArrowLeftRight, colore: 'viola' },
  genera: { icona: Shuffle, colore: 'ambra' },
  segnalazioni: { icona: BellRing, colore: 'viola' },
  segna: { icona: ListChecks, colore: 'blu' },
  risposte: { icona: Megaphone, colore: 'blu' },
}

/** Le cose da fare per chi gestisce la classe (capo, vice, docenti con permesso). */
export function PannelloDaFare({ classId }: { classId?: string }) {
  const adesso = useAdesso()
  const tutte = useInterrogazioniOsservate().filter((d) => !classId || d.classId === classId)
  const voci = tutte.flatMap((d) => vociDaFare(d, adesso).map((voce) => ({ voce, d }))).sort(confrontaDaFare)
  if (voci.length === 0) return null
  const piuClassi = new Set(tutte.map((d) => d.classId)).size > 1

  return (
    <Scheda titolo={`Da fare (${voci.length})`} icona={Sparkles} tono="avviso">
      <ul className="divide-y divide-slate-100 dark:divide-slate-800" aria-label="Da fare">
        {voci.map(({ voce, d }) => (
          <RigaLink
            key={`${d.chiave}/${voce.tipo}`}
            to={percorso(d)}
            sinistra={<Pallino icona={ICONA_DA_FARE[voce.tipo].icona} colore={ICONA_DA_FARE[voce.tipo].colore} />}
          >
            <Titolo d={d} mostraClasse={piuClassi} />
            <span className="block text-slate-600 dark:text-slate-400">{testoDaFare(voce)}</span>
          </RigaLink>
        ))}
      </ul>
    </Scheda>
  )
}

// ───────────── Le mie interrogazioni ─────────────

function DescrizioneMia({ v, adesso }: { v: VoceMia; adesso: Date }) {
  switch (v.tipo) {
    case 'da-scegliere':
      return (
        <>
          Scegli quando essere interrogato entro {formattaScadenza(new Date(v.scadenza))} (
          {tempoMancante(new Date(v.scadenza), adesso)})
        </>
      )
    case 'scelta':
      return (
        <>
          Hai scelto: {descriviScelta(v)}
          {' · '}lista dopo {formattaScadenza(new Date(v.scadenza))}
        </>
      )
    case 'attesa-lista':
      return <>Preferenze chiuse: la lista sarà pubblicata a breve</>
    case 'in-lista':
      return (
        <>
          <strong>{v.posizione === null ? 'Data fissa' : `n° ${v.posizione} di ${v.totale}`}</strong> · {v.testo}
        </>
      )
    case 'docente-lista':
      return (
        <>
          {v.interrogati} su {v.totale} interrogati
        </>
      )
  }
}

/** A sinistra della riga: la mia posizione in lista, oppure un'icona dello stato. */
function SimboloMia({ v }: { v: VoceMia }) {
  switch (v.tipo) {
    case 'in-lista':
      return v.posizione === null ? <Pallino icona={CalendarCheck} colore="pieno" /> : <Pallino colore="pieno">{v.posizione}°</Pallino>
    case 'da-scegliere':
      return <Pallino icona={Hourglass} colore="ambra" />
    case 'scelta':
      return <Pallino icona={CheckCheck} colore="verde" />
    case 'attesa-lista':
      return <Pallino icona={Shuffle} colore="grigio" />
    case 'docente-lista':
      return <Pallino icona={ListChecks} colore="viola" />
  }
}

/** Tutte le interrogazioni dell'utente in tutte le classi, in un colpo d'occhio. */
export function PannelloMie({ caricamento }: { caricamento: boolean }) {
  const adesso = useAdesso()
  const tutte = useInterrogazioniOsservate()
  const voci = tutte
    .flatMap((d) => {
      const voce = voceMia(d, adesso)
      return voce ? [{ voce, d }] : []
    })
    .sort(confrontaMie)
  const piuClassi = new Set(tutte.map((d) => d.classId)).size > 1

  return (
    <Scheda titolo="Le mie interrogazioni" icona={CalendarCheck}>
      {voci.length === 0 ? (
        <Vuoto icona={CheckCheck}>
          {caricamento ? 'Caricamento…' : 'Nessuna interrogazione in corso. Quando il capoclasse ne aggiunge una, la trovi qui.'}
        </Vuoto>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800" aria-label="Le mie interrogazioni">
          {voci.map(({ voce, d }) => (
            <RigaLink
              key={d.chiave}
              to={percorso(d)}
              sinistra={<SimboloMia v={voce} />}
            >
              <Titolo d={d} mostraClasse={piuClassi} />
              <span className="block text-slate-600 dark:text-slate-400">
                <DescrizioneMia v={voce} adesso={adesso} />
              </span>
            </RigaLink>
          ))}
        </ul>
      )}
    </Scheda>
  )
}
